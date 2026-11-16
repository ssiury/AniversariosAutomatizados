import path from 'node:path';
import { Eta } from 'eta';
import { config } from '#config';
import * as datas from './datas.js';
import { icone } from './icones.js';

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/**
 * Até duas iniciais (primeiro e último nome), para os avatares. Só letras: o resultado é seguro
 * para ir ao HTML sem escape.
 */
function iniciais(nome) {
  const partes = String(nome || '')
    .split(/\s+/)
    .map((p) => p.match(/\p{L}/u)?.[0])
    .filter(Boolean);
  const escolhidas = partes.length > 1 ? [partes[0], partes.at(-1)] : partes;
  return escolhidas.join('').toUpperCase() || '?';
}

export const eta = new Eta({ views: path.join(config.raiz, 'views'), cache: config.producao });

const escapar = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Texto do WhatsApp em HTML para a prévia: escapa tudo primeiro e só então aplica *negrito*,
 * _itálico_, ~tachado~ e as quebras de linha. O resultado é seguro para ir ao HTML sem escape.
 */
export function formatarWhatsapp(texto) {
  return escapar(texto)
    .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])_([^_\n]+)_/g, '$1<i>$2</i>')
    .replace(/~([^~\n]+)~/g, '<s>$1</s>')
    .replace(/\r?\n/g, '<br>');
}

export const helpers = {
  formatarBR: datas.formatarBR,
  formatarDiaMes: datas.formatarDiaMes,
  formatarDataHora: datas.formatarDataHora,
  nomeMes: datas.nomeMes,
  sexo: (s) => (s === 'F' ? 'Feminino' : 'Masculino'),
  icone,
  formatarWhatsapp,
  diaSemana: datas.diaSemana,
  /** Hora "HH:MM" de um datetime do SQLite ("AAAA-MM-DD HH:MM:SS"). */
  hora: (sqlDateTime) => String(sqlDateTime ?? '').slice(11, 16),
  capitalizar: (s) => (s ? s[0].toUpperCase() + s.slice(1) : ''),
  iniciais,
  /** Dia do mês de uma data ISO, sem zero à esquerda. */
  dia: (iso) => String(Number(iso.slice(8, 10))),
  /** Mês abreviado de uma data ISO (ex.: "nov"). */
  mesCurto: (iso) => MESES_CURTOS[Number(iso.slice(5, 7)) - 1],
};

export function render(res, view, dados = {}, status = 200) {
  res
    .status(status)
    .type('html')
    .send(eta.render(view, { ...res.locals, h: helpers, ...dados }));
}

export function ehHtmx(req) {
  return req.get('HX-Request') === 'true';
}
