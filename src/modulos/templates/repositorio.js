import { getDb } from '#compartilhado/banco/index.js';

/** @typedef {import('#compartilhado/tipos.js').Template} Template */

const CAMPOS = ['nome', 'fundo', 'cor_destaque', 'mensagem_arte', 'legenda'];
const ORDEM = "CASE tipo WHEN 'masculino' THEN 1 WHEN 'feminino' THEN 2 ELSE 3 END";

/** @returns {Template[]} */
export function listar() {
  return /** @type {Template[]} */ (getDb().prepare(`SELECT * FROM template ORDER BY ${ORDEM}`).all());
}

/** @returns {Template | undefined} */
export function obter(id) {
  return /** @type {Template | undefined} */ (getDb().prepare('SELECT * FROM template WHERE id = ?').get(id));
}

export function atualizar(id, dados) {
  const campos = CAMPOS.filter((c) => c in dados);
  if (!campos.length) return;
  getDb()
    .prepare(
      `UPDATE template SET ${campos.map((c) => `${c} = @${c}`).join(', ')},
    atualizado_em = datetime('now', 'localtime') WHERE id = @id`,
    )
    .run({ ...dados, id });
}
