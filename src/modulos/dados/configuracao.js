import { getDb, CONFIG_PADRAO } from './index.js';

export function todas() {
  const linhas = getDb().prepare('SELECT chave, valor FROM configuracao').all();
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
