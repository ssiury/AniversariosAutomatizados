import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '#config';
import { formatarDiaMes } from '#compartilhado/datas.js';

// A VM tem 1 GB de RAM: uma imagem por vez e sem cache.
sharp.cache(false);
sharp.concurrency(1);

export const LARGURA = 1080;
export const ALTURA = 1350;
const FOTO = { cx: 540, cy: 560, r: 270 };
const FONTE = "'DejaVu Sans', 'Liberation Sans', Arial, sans-serif";

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

function corValida(cor) {
  return /^#[0-9a-f]{6}$/i.test(cor || '') ? cor : '#1565c0';
}

function misturar(hex, alvo, fator) {
  const c = parseInt(hex.slice(1), 16);
  const a = parseInt(alvo.slice(1), 16);
  const canal = (v, s) => Math.round(((v >> s) & 255) * (1 - fator) + ((a >> s) & 255) * fator);
  return `#${[16, 8, 0].map((s) => canal(c, s).toString(16).padStart(2, '0')).join('')}`;
}

export function iniciais(nome) {
  const partes = String(nome || '')
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-ZÀ-Ý]/.test(p));
  const sel = partes.length > 1 ? [partes[0], partes[partes.length - 1]] : partes.slice(0, 1);
  return sel.map((p) => p[0].toUpperCase()).join('') || '?';
}

/** Quebra a frase em até 2 linhas (respeita quebras manuais). */
export function linhasMensagem(texto, maxCaracteres = 30) {
  const manuais = String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (manuais.length >= 2) return manuais.slice(0, 2);
  const palavras = (manuais[0] || '').split(/\s+/).filter(Boolean);
  const linhas = [''];
  for (const p of palavras) {
    const atual = linhas[linhas.length - 1];
    if (atual && (atual + ' ' + p).length > maxCaracteres && linhas.length < 2) linhas.push(p);
    else linhas[linhas.length - 1] = atual ? `${atual} ${p}` : p;
  }
  return linhas.filter(Boolean);
}

function fundoPadraoSvg(cor) {
  const claro = misturar(cor, '#ffffff', 0.55);
  const escuro = misturar(cor, '#000000', 0.25);
  const confetes = [
    [120, 140, 18],
    [960, 120, 26],
    [880, 330, 12],
    [180, 420, 14],
    [80, 780, 22],
    [1000, 720, 16],
    [300, 60, 10],
    [760, 60, 14],
    [1010, 520, 10],
    [60, 560, 10],
  ]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" fill-opacity="0.35"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA}" height="${ALTURA}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${escuro}"/><stop offset="0.6" stop-color="${cor}"/><stop offset="1" stop-color="${claro}"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>${confetes}
  </svg>`;
}

function sobreposicaoSvg({ nome, cor, mensagem, dataTexto, ministerio, comFoto }) {
  const linhas = linhasMensagem(mensagem);
  const tamNome = Math.max(38, Math.min(68, Math.floor(1500 / Math.max(nome.length, 1))));
  const corEscura = misturar(cor, '#000000', 0.35);
  const semFoto = comFoto
    ? ''
    : `
    <circle cx="${FOTO.cx}" cy="${FOTO.cy}" r="${FOTO.r}" fill="${misturar(cor, '#ffffff', 0.75)}"/>
    <text x="${FOTO.cx}" y="${FOTO.cy + 70}" text-anchor="middle" font-family="${FONTE}" font-size="200"
      font-weight="bold" fill="${corEscura}">${esc(iniciais(nome))}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA}" height="${ALTURA}">
    <rect x="100" y="88" width="880" height="130" rx="65" fill="#ffffff" fill-opacity="0.92"/>
    <text x="540" y="178" text-anchor="middle" font-family="${FONTE}" font-size="76" font-weight="bold"
      fill="${cor}">Feliz Aniversário!</text>
    ${semFoto}
    <circle cx="${FOTO.cx}" cy="${FOTO.cy}" r="${FOTO.r + 9}" fill="none" stroke="#ffffff" stroke-width="10"/>
    <circle cx="${FOTO.cx}" cy="${FOTO.cy}" r="${FOTO.r + 20}" fill="none" stroke="${cor}" stroke-width="16"/>
    <rect x="70" y="890" width="940" height="400" rx="40" fill="#ffffff" fill-opacity="0.93"/>
    <text x="540" y="990" text-anchor="middle" font-family="${FONTE}" font-size="${tamNome}" font-weight="bold"
      fill="#222222">${esc(nome)}</text>
    ${linhas
      .map(
        (l, i) => `<text x="540" y="${1068 + i * 54}" text-anchor="middle" font-family="${FONTE}"
      font-size="40" fill="#444444">${esc(l)}</text>`,
      )
      .join('')}
    <text x="540" y="1200" text-anchor="middle" font-family="${FONTE}" font-size="36" font-weight="bold"
      fill="${cor}">${esc(dataTexto)}</text>
    <text x="540" y="1254" text-anchor="middle" font-family="${FONTE}" font-size="28"
      fill="#777777">${esc(ministerio)}</text>
  </svg>`;
}

function arquivoDoStorage(relativo) {
  if (!relativo) return null;
  const abs = path.resolve(config.storage, relativo);
  if (!abs.startsWith(config.storage + path.sep)) return null;
  return fs.existsSync(abs) ? abs : null;
}

/**
 * Gera a arte JPEG 1080×1350.
 * Template sem fundo (ou fundo ausente) usa o fundo padrão com a cor de destaque — nunca falha por isso.
 */
export async function gerarArte({ membro, template, dataAniversario, nomeMinisterio }) {
  const cor = corValida(template?.cor_destaque);
  const fundoArq = arquivoDoStorage(template?.fundo);
  const base = fundoArq
    ? await sharp(fundoArq).rotate().resize(LARGURA, ALTURA, { fit: 'cover' }).toBuffer()
    : Buffer.from(fundoPadraoSvg(cor));

  const camadas = [];
  const fotoArq = arquivoDoStorage(membro.foto);
  if (fotoArq) {
    const d = FOTO.r * 2;
    const mascara = Buffer.from(
      `<svg width="${d}" height="${d}"><circle cx="${FOTO.r}" cy="${FOTO.r}" r="${FOTO.r}" fill="#fff"/></svg>`,
    );
    const foto = await sharp(fotoArq)
      .rotate()
      .resize(d, d, { fit: 'cover' })
      .composite([{ input: mascara, blend: 'dest-in' }])
      .png()
      .toBuffer();
    camadas.push({ input: foto, left: FOTO.cx - FOTO.r, top: FOTO.cy - FOTO.r });
  }
  camadas.push({
    input: Buffer.from(
      sobreposicaoSvg({
        nome: membro.nome,
        cor,
        mensagem: template?.mensagem_arte,
        dataTexto: formatarDiaMes(dataAniversario),
        ministerio: nomeMinisterio,
        comFoto: !!fotoArq,
      }),
    ),
    left: 0,
    top: 0,
  });

  return sharp(base).resize(LARGURA, ALTURA).composite(camadas).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

/** Redimensiona para miniatura (usado nas prévias do painel). */
export function miniatura(buffer, largura) {
  return sharp(buffer).resize(largura).jpeg({ quality: 80 }).toBuffer();
}

/** Normaliza uma imagem enviada pelo painel e grava em storage/<pasta>/<nome>.jpg. Retorna o caminho relativo. */
export async function salvarImagem(entrada, pasta, nome, { largura, altura }) {
  const dir = path.join(config.storage, pasta);
  fs.mkdirSync(dir, { recursive: true });
  const relativo = `${pasta}/${nome}.jpg`;
  await sharp(entrada)
    .rotate()
    .resize(largura, altura, { fit: 'cover' })
    .jpeg({ quality: 88 })
    .toFile(path.join(config.storage, relativo));
  return relativo;
}

export function removerArquivo(relativo) {
  const abs = arquivoDoStorage(relativo);
  if (abs) fs.rmSync(abs, { force: true });
}
