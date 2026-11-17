// Monitor externo no padrão "dead man's switch" (ex.: healthchecks.io).
// Ao fim de cada ciclo o sistema avisa se está saudável. Se o aviso não chegar no prazo, ou chegar
// como falha, o serviço externo alerta o responsável por e-mail, Telegram etc.
import { config } from '#config';
import { logger } from '#compartilhado/logger.js';

// Situações em que o envio do dia está comprometido e alguém precisa agir.
const MOTIVOS_DE_FALHA = new Set(['WhatsApp desconectado', 'Grupo do WhatsApp não configurado']);

/**
 * Classifica o resultado de um ciclo: 'ok' ou 'falha'.
 * O WhatsApp é conferido mesmo antes do horário de envio, para dar tempo de reconectar.
 */
export function avaliarCiclo(resultado, whatsapp = null) {
  if (whatsapp && !whatsapp.conectado && !whatsapp.desativado) return 'falha';
  if (resultado.falhas > 0) return 'falha';
  if (MOTIVOS_DE_FALHA.has(resultado.motivo)) return 'falha';
  return 'ok';
}

function resumo(r) {
  return r.executado ? `${r.enviados} enviado(s), ${r.falhas} falha(s), ${r.pulados} pulado(s)` : r.motivo;
}

/**
 * Envia o sinal de vida ao monitor. Nunca lança: o monitor não pode derrubar o envio.
 * @param {object} resultado resultado de `executarCiclo`
 * @param {object} [opcoes]
 * @param {{ conectado: boolean, desativado?: boolean } | null} [opcoes.whatsapp] estado atual do WhatsApp
 * @param {string} [opcoes.url] URL de ping (padrão: MONITOR_URL)
 * @param {(url: string, init?: RequestInit) => Promise<unknown>} [opcoes.enviar] substituível nos testes
 */
export async function reportarCiclo(resultado, { whatsapp = null, url = config.monitorUrl, enviar = fetch } = {}) {
  if (!url) return;
  const destino = avaliarCiclo(resultado, whatsapp) === 'falha' ? `${url.replace(/\/+$/, '')}/fail` : url;
  try {
    await enviar(destino, { method: 'POST', body: resumo(resultado), signal: AbortSignal.timeout(10_000) });
  } catch (e) {
    logger.warn({ modulo: 'monitor', err: e }, 'Não foi possível avisar o monitor');
  }
}
