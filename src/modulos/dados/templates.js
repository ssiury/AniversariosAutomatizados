import { getDb } from './index.js';

const CAMPOS = ['nome', 'fundo', 'cor_destaque', 'mensagem_arte', 'legenda'];
const ORDEM = "CASE tipo WHEN 'masculino' THEN 1 WHEN 'feminino' THEN 2 ELSE 3 END";

export function listar() {
  return getDb().prepare(`SELECT * FROM template ORDER BY ${ORDEM}`).all();
}

export function obter(id) {
  return getDb().prepare('SELECT * FROM template WHERE id = ?').get(id);
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
