// WhatsApp embutido (Baileys). Interface pública: iniciar, status, enviarImagem, listarGrupos, desconectar.
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import QRCode from 'qrcode';
import { config } from '#config';
import { logger as raiz } from '#compartilhado/logger.js';

export const eventos = new EventEmitter();

const dirSessao = () => path.join(config.storage, 'whatsapp');
// O Baileys é muito verboso: tem nível de log próprio (WHATSAPP_LOG).
const logger = raiz.child({ modulo: 'whatsapp' }, { level: config.whatsappLog });

let sock = null;
let baileys = null;
let tentativasReconexao = 0;
const estado = { conectado: false, conectando: false, qr: null, numero: null, erro: null, desativado: false };

export function status() {
  return { ...estado };
}

async function carregarBaileys() {
  if (!baileys) baileys = await import('@whiskeysockets/baileys');
  return baileys;
}

export async function iniciar() {
  if (config.whatsappDesativado) {
    estado.desativado = true;
    estado.erro = 'WhatsApp desativado por WHATSAPP_DESATIVADO=1';
    return;
  }
  const b = await carregarBaileys();
  const makeWASocket = b.makeWASocket ?? b.default;
  fs.mkdirSync(dirSessao(), { recursive: true });
  const { state, saveCreds } = await b.useMultiFileAuthState(dirSessao());

  let version;
  try {
    ({ version } = await b.fetchLatestBaileysVersion());
  } catch {
    version = undefined;
  }

  estado.conectando = true;
  sock = makeWASocket({
    auth: state,
    version,
    logger,
    browser: b.Browsers.ubuntu('Aniversários'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });
  const atual = sock;

  atual.ev.on('creds.update', saveCreds);
  atual.ev.on('connection.update', async (u) => {
    if (atual !== sock) return;
    if (u.qr) {
      estado.qr = await QRCode.toDataURL(u.qr, { margin: 1, width: 280 });
      estado.erro = null;
    }
    if (u.connection === 'open') {
      Object.assign(estado, { conectado: true, conectando: false, qr: null, erro: null });
      estado.numero = atual.user?.id?.split(':')[0]?.split('@')[0] ?? null;
      tentativasReconexao = 0;
      raiz.info({ modulo: 'whatsapp', numero: estado.numero }, 'WhatsApp conectado');
      eventos.emit('conectado');
    }
    if (u.connection === 'close') {
      estado.conectado = false;
      const codigo = u.lastDisconnect?.error?.output?.statusCode;
      const deslogado = codigo === b.DisconnectReason.loggedOut;
      estado.erro = deslogado ? 'Sessão encerrada no celular. Escaneie o QR Code novamente.' : null;
      if (deslogado) limparSessao();
      tentativasReconexao += 1;
      const espera = Math.min(60_000, 2_000 * tentativasReconexao);
      setTimeout(
        () =>
          iniciar().catch((e) => {
            estado.erro = e.message;
          }),
        deslogado ? 1_000 : espera,
      );
    }
  });
}

function limparSessao() {
  fs.rmSync(dirSessao(), { recursive: true, force: true });
  estado.numero = null;
}

function exigirConexao() {
  if (!sock || !estado.conectado) throw new Error('WhatsApp não está conectado');
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const aleatorio = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

/** Mostra "digitando…" no grupo por alguns segundos, como uma pessoa faria. Falha aqui não impede o envio. */
async function simularDigitacao(jid) {
  try {
    await sock.sendPresenceUpdate('composing', jid);
    await esperar(aleatorio(3_000, 6_000));
    await sock.sendPresenceUpdate('paused', jid);
  } catch (e) {
    logger.warn({ err: e }, 'Não foi possível mostrar "digitando"');
  }
}

/** Envia uma imagem com legenda. Retorna o ID da mensagem. */
export async function enviarImagem(jid, imagem, legenda) {
  exigirConexao();
  await simularDigitacao(jid);
  exigirConexao();
  const msg = await sock.sendMessage(jid, { image: imagem, caption: legenda, mimetype: 'image/jpeg' });
  return msg?.key?.id ?? null;
}

/** Lista os grupos de que o número participa. */
export async function listarGrupos() {
  exigirConexao();
  const grupos = await sock.groupFetchAllParticipating();
  return Object.values(grupos)
    .map((g) => ({ id: g.id, nome: g.subject || g.id }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Encerra a sessão e gera um novo QR Code. */
export async function desconectar() {
  const antigo = sock;
  sock = null;
  Object.assign(estado, { conectado: false, qr: null, numero: null });
  try {
    await antigo?.logout();
  } catch {
    antigo?.end?.(undefined);
  }
  limparSessao();
  await iniciar();
}
