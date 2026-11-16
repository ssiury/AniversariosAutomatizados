import { getDb } from '#compartilhado/banco/index.js';

/** @typedef {{ n: number }} Contagem */
/**
 * Envio com os nomes do membro e do template, como aparece no painel.
 * @typedef {import('#compartilhado/tipos.js').Envio & { membro_nome: string, template_nome: string | null,
 *   template_tipo: string | null }} EnvioCompleto
 */

export function registrar(envio) {
  const r = getDb()
    .prepare(
      `INSERT INTO envio
      (membro_id, template_id, data_aniversario, status, tentativa, detalhe, arquivo_arte)
    VALUES (@membro_id, @template_id, @data_aniversario, @status, @tentativa, @detalhe, @arquivo_arte)`,
    )
    .run({ template_id: null, tentativa: 1, detalhe: null, arquivo_arte: null, ...envio });
  return Number(r.lastInsertRowid);
}

export function jaEnviado(membroId, dataISO) {
  return !!getDb()
    .prepare(
      `SELECT 1 FROM envio
    WHERE membro_id = ? AND data_aniversario = ? AND status = 'enviado'`,
    )
    .get(membroId, dataISO);
}

/** @returns {number} */
export function contarFalhas(membroId, dataISO) {
  const linha = /** @type {Contagem} */ (
    getDb()
      .prepare(
        `SELECT COUNT(*) AS n FROM envio
    WHERE membro_id = ? AND data_aniversario = ? AND status = 'falhou'`,
      )
      .get(membroId, dataISO)
  );
  return linha.n;
}

/** 'enviado', 'falhou' (com o número de falhas) ou 'aguardando'. */
export function situacaoDoDia(membroId, dataISO) {
  if (jaEnviado(membroId, dataISO)) return { status: 'enviado', falhas: 0 };
  const falhas = contarFalhas(membroId, dataISO);
  return { status: falhas ? 'falhou' : 'aguardando', falhas };
}

const SELECT_COMPLETO = `SELECT e.*, m.nome AS membro_nome, t.nome AS template_nome, t.tipo AS template_tipo
  FROM envio e
  JOIN membro m ON m.id = e.membro_id
  LEFT JOIN template t ON t.id = e.template_id`;

/** @returns {EnvioCompleto[]} */
export function ultimos(limite = 5) {
  return /** @type {EnvioCompleto[]} */ (getDb().prepare(`${SELECT_COMPLETO} ORDER BY e.id DESC LIMIT ?`).all(limite));
}

/** Último registro de envio do membro para o aniversário da data (o mais recente primeiro). */
/** @returns {EnvioCompleto | undefined} */
export function ultimoDoDia(membroId, dataISO) {
  return /** @type {EnvioCompleto | undefined} */ (
    getDb()
      .prepare(`${SELECT_COMPLETO} WHERE e.membro_id = ? AND e.data_aniversario = ? ORDER BY e.id DESC LIMIT 1`)
      .get(membroId, dataISO)
  );
}

/** Um teste que falhou é gravado como status 'teste' com o detalhe "Falhou: ...". */
const EH_FALHA = "(e.status = 'falhou' OR (e.status = 'teste' AND COALESCE(e.detalhe, '') LIKE 'Falhou:%'))";

/** Filtros do histórico: enviados ao grupo, testes (com ou sem sucesso) e falhas (do dia ou de teste). */
const FILTROS = {
  enviado: "e.status = 'enviado'",
  teste: "e.status = 'teste'",
  falhas: EH_FALHA,
};

/** Totais para o resumo do histórico. */
export function contagens() {
  return /** @type {{ enviados: number, testes: number, testesTotal: number, falhas: number, total: number }} */ (
    getDb()
      .prepare(
        `SELECT
          COALESCE(SUM(e.status = 'enviado'), 0) AS enviados,
          COALESCE(SUM(e.status = 'teste' AND COALESCE(e.detalhe, '') NOT LIKE 'Falhou:%'), 0) AS testes,
          COALESCE(SUM(e.status = 'teste'), 0) AS testesTotal,
          COALESCE(SUM(${EH_FALHA}), 0) AS falhas,
          COUNT(*) AS total
        FROM envio e`,
      )
      .get()
  );
}

export function listar({ status = '', pagina = 1, porPagina = 50 } = {}) {
  const filtro = FILTROS[status] ? `WHERE ${FILTROS[status]}` : '';
  const { n: total } = /** @type {Contagem} */ (
    getDb().prepare(`SELECT COUNT(*) AS n FROM envio e ${filtro}`).get({ status })
  );
  const linhas = /** @type {EnvioCompleto[]} */ (
    getDb()
      .prepare(`${SELECT_COMPLETO} ${filtro} ORDER BY e.id DESC LIMIT @lim OFFSET @off`)
      .all({ status, lim: porPagina, off: (pagina - 1) * porPagina })
  );
  return { total, linhas, paginas: Math.max(1, Math.ceil(total / porPagina)) };
}
