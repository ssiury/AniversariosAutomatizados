// Copia para o repositório só os ícones (Lucide) e as fontes (Inter) que o painel usa.
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

fs.mkdirSync(destinoFontes, { recursive: true });
const fontes = path.join(raiz, 'node_modules/@fontsource-variable/inter');
for (const arquivo of ['inter-latin-wght-normal.woff2', 'inter-latin-ext-wght-normal.woff2']) {
  fs.copyFileSync(path.join(fontes, 'files', arquivo), path.join(destinoFontes, arquivo));
}
fs.copyFileSync(path.join(fontes, 'LICENSE'), path.join(destinoFontes, 'LICENSE-Inter.txt'));

console.log(`${ICONES.length} ícones e 2 fontes copiados.`);
