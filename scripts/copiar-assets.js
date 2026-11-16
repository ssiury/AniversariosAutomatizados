// Copia para o repositório só os ícones (Lucide) e as fontes que o painel usa.
// Os pacotes completos têm dezenas de MB e ficam só no desenvolvimento; a imagem leva os arquivos copiados.
// Uso: npm run assets   (rode de novo depois de acrescentar um ícone em ICONES)
import fs from 'node:fs';
import path from 'node:path';
import { ICONES } from '#compartilhado/icones.js';

const raiz = path.resolve(import.meta.dirname, '..');
const destinoIcones = path.join(raiz, 'views/icones');
const destinoFontes = path.join(raiz, 'public/fontes');

fs.rmSync(destinoIcones, { recursive: true, force: true });
fs.mkdirSync(destinoIcones, { recursive: true });
for (const nome of ICONES) {
  fs.copyFileSync(
    path.join(raiz, 'node_modules/lucide-static/icons', `${nome}.svg`),
    path.join(destinoIcones, `${nome}.svg`),
  );
}
fs.copyFileSync(path.join(raiz, 'node_modules/lucide-static/LICENSE'), path.join(destinoIcones, 'LICENSE'));

// Família → arquivos (subconjuntos latin e latin-ext, eixo de peso variável) e nome da licença.
const FONTES = {
  inter: ['inter-latin-wght-normal.woff2', 'inter-latin-ext-wght-normal.woff2'],
  'bricolage-grotesque': [
    'bricolage-grotesque-latin-wght-normal.woff2',
    'bricolage-grotesque-latin-ext-wght-normal.woff2',
  ],
  'jetbrains-mono': ['jetbrains-mono-latin-wght-normal.woff2'],
};

fs.rmSync(destinoFontes, { recursive: true, force: true });
fs.mkdirSync(destinoFontes, { recursive: true });
for (const [familia, arquivos] of Object.entries(FONTES)) {
  const origem = path.join(raiz, 'node_modules/@fontsource-variable', familia);
  for (const arquivo of arquivos) {
    fs.copyFileSync(path.join(origem, 'files', arquivo), path.join(destinoFontes, arquivo));
  }
  fs.copyFileSync(path.join(origem, 'LICENSE'), path.join(destinoFontes, `LICENSE-${familia}.txt`));
}

console.log(`${ICONES.length} ícones e ${Object.values(FONTES).flat().length} arquivos de fonte copiados.`);
