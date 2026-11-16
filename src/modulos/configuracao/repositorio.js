import { getDb } from '#compartilhado/banco/index.js';

/** Valores usados enquanto a chave não foi salva no painel. */
export const CONFIG_PADRAO = Object.freeze({
  envio_ativo: '1',
  grupo_whatsapp: '',
  grupo_whatsapp_nome: '',
  horario_envio: '08:00',
  idade_limite_infantil: '12',
  nome_ministerio: 'Ministério de Mídia',
});

export function todas() {
  const linhas = /** @type {{ chave: string, valor: string | null }[]} */ (
    getDb().prepare('SELECT chave, valor FROM configuracao').all()
  );
  return { ...CONFIG_PADRAO, ...Object.fromEntries(linhas.map((l) => [l.chave, l.valor ?? ''])) };
}

export function obter(chave) {
  return todas()[chave];
}

export function definir(valores) {
  const st = getDb().prepare(`INSERT INTO configuracao (chave, valor) VALUES (?, ?)
    ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor`);
  getDb().transaction(() => {
    for (const [k, v] of Object.entries(valores)) st.run(k, v == null ? '' : String(v));
  })();
}
