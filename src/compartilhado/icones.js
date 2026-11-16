// Ícones Lucide (https://lucide.dev, licença ISC) desenhados inline no HTML.
// Os SVGs ficam em views/icones/, copiados por `npm run assets` a partir desta lista.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '#config';

export const ICONES = Object.freeze([
  'arrow-left',
  'baby',
  'cake',
  'calendar-days',
  'chevron-left',
  'chevron-right',
  'circle-alert',
  'circle-check',
  'clock',
  'external-link',
  'history',
  'image',
  'info',
  'layout-dashboard',
  'log-out',
  'mars',
  'message-circle',
  'moon',
  'palette',
  'play',
  'plus',
  'search',
  'send',
  'settings',
  'smartphone',
  'sun',
  'trash-2',
  'upload',
  'user-round',
  'users',
  'venus',
]);

const cache = new Map();

/** Conteúdo interno do SVG (sem a tag <svg> nem o comentário de licença). */
function desenho(nome) {
  if (cache.has(nome)) return cache.get(nome);
  if (!ICONES.includes(nome))
    throw new Error(`Ícone desconhecido: "${nome}". Acrescente-o em ICONES e rode npm run assets.`);
  const svg = fs.readFileSync(path.join(config.raiz, 'views/icones', `${nome}.svg`), 'utf8');
  const interno = svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\s*\n\s*/g, '');
  cache.set(nome, interno);
  return interno;
}

/**
 * Devolve o SVG do ícone. Use com a tag de saída sem escape do Eta: <%~ it.h.icone('users') %>
 * @param {string} nome nome do ícone na lista ICONES
 * @param {string} [classe] classes CSS extras
 */
export function icone(nome, classe = '') {
  return (
    `<svg class="icone${classe ? ` ${classe}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${desenho(nome)}</svg>`
  );
}
