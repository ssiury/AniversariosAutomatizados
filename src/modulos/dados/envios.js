import { getDb } from './index.js';

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

export function contarFalhas(membroId, dataISO) {
  return getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM envio
    WHERE membro_id = ? AND data_aniversario = ? AND status = 'falhou'`,
    )
    .get(membroId, dataISO).n;
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

export function ultimos(limite = 5) {
  return getDb().prepare(`${SELECT_COMPLETO} ORDER BY e.id DESC LIMIT ?`).all(limite);
}

export function listar({ status = '', pagina = 1, porPagina = 50 } = {}) {
  const filtro = ['enviado', 'falhou', 'teste'].includes(status) ? 'WHERE e.status = @status' : '';
  const total = getDb().prepare(`SELECT COUNT(*) AS n FROM envio e ${filtro}`).get({ status }).n;
  const linhas = getDb()
    .prepare(`${SELECT_COMPLETO} ${filtro} ORDER BY e.id DESC LIMIT @lim OFFSET @off`)
    .all({ status, lim: porPagina, off: (pagina - 1) * porPagina });
  return { total, linhas, paginas: Math.max(1, Math.ceil(total / porPagina)) };
}
