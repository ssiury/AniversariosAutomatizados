import { getDb } from '#compartilhado/banco/index.js';
import { ehAniversario } from '#compartilhado/datas.js';

/** @typedef {import('#compartilhado/tipos.js').Membro} Membro */

const CAMPOS = ['nome', 'data_nascimento', 'sexo', 'ativo', 'foto', 'template_fixo_id'];

export function listar({ busca = '', sexo = '', situacao = '', mes = '' } = {}) {
  const where = [];
  const params = {};
  if (busca.trim()) {
    where.push('nome LIKE @busca');
    params.busca = `%${busca.trim()}%`;
  }
  if (sexo === 'M' || sexo === 'F') {
    where.push('sexo = @sexo');
    params.sexo = sexo;
  }
  if (situacao === 'ativo') where.push('ativo = 1');
  if (situacao === 'inativo') where.push('ativo = 0');
  if (/^\d{1,2}$/.test(String(mes)) && Number(mes) >= 1 && Number(mes) <= 12) {
    where.push('substr(data_nascimento, 6, 2) = @mes');
    params.mes = String(mes).padStart(2, '0');
  }
  const sql = `SELECT * FROM membro ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY nome COLLATE NOCASE`;
  return /** @type {Membro[]} */ (getDb().prepare(sql).all(params));
}

/** @returns {Membro[]} */
export function ativos() {
  return /** @type {Membro[]} */ (
    getDb().prepare('SELECT * FROM membro WHERE ativo = 1 ORDER BY nome COLLATE NOCASE').all()
  );
}

/** @returns {Membro | undefined} */
export function obter(id) {
  return /** @type {Membro | undefined} */ (getDb().prepare('SELECT * FROM membro WHERE id = ?').get(id));
}

export function criar(dados) {
  const linha = Object.fromEntries(CAMPOS.map((c) => [c, dados[c] ?? null]));
  const r = getDb()
    .prepare(
      `INSERT INTO membro (${CAMPOS.join(', ')})
    VALUES (${CAMPOS.map((c) => `@${c}`).join(', ')})`,
    )
    .run(linha);
  return Number(r.lastInsertRowid);
}

export function atualizar(id, dados) {
  const campos = CAMPOS.filter((c) => c in dados);
  if (!campos.length) return;
  getDb()
    .prepare(
      `UPDATE membro SET ${campos.map((c) => `${c} = @${c}`).join(', ')},
    atualizado_em = datetime('now', 'localtime') WHERE id = @id`,
    )
    .run({ ...dados, id });
}

export function remover(id) {
  getDb().prepare('DELETE FROM membro WHERE id = ?').run(id);
}

/** @returns {{ ativos: number, inativos: number }} */
export function contar() {
  return /** @type {{ ativos: number, inativos: number }} */ (
    getDb()
      .prepare(
        `SELECT
      COALESCE(SUM(ativo = 1), 0) AS ativos,
      COALESCE(SUM(ativo = 0), 0) AS inativos
    FROM membro`,
      )
      .get()
  );
}

/** Membros ativos que fazem aniversário na data (considera 29/02 em ano não bissexto). */
export function aniversariantesDoDia(dataISO) {
  return ativos().filter((m) => ehAniversario(m.data_nascimento, dataISO));
}
