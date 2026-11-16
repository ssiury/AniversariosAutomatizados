import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import { hojeISO, horaMinuto, ehAniversario, proximoAniversario } from '../../lib/datas.js';
import { membros, envios, configuracao } from '../dados/index.js';
import { criarResolvedor, montarLegenda } from '../templates/index.js';
import { gerarArte } from '../arte/index.js';
import * as whatsapp from '../whatsapp/index.js';

// Canal de envio substituível (testes usam um canal falso).
let canal = whatsapp;
export function usarCanal(c) {
  canal = c;
}

// Pausa aleatória entre dois envios do mesmo ciclo, para não postar várias artes em sequência imediata.
// Substituível nos testes.
const PAUSA_MIN_MS = 20_000;
const PAUSA_MAX_MS = 60_000;
let pausar = () => new Promise((r) => setTimeout(r, PAUSA_MIN_MS + Math.random() * (PAUSA_MAX_MS - PAUSA_MIN_MS)));
export function usarPausa(fn) {
  pausar = fn;
}

// Trava única para o ciclo automático e o "Enviar agora": os dois nunca enviam ao mesmo tempo,
// o que evita a mesma arte ser postada duas vezes no grupo.
let ocupado = false;
let ultimoCiclo = null;

export const MOTIVO_OCUPADO = 'Já existe um envio em andamento';

export function infoUltimoCiclo() {
  return ultimoCiclo;
}

async function salvarArte(buffer, membroId, dataISO, sufixo) {
  const dir = path.join(config.storage, 'artes');
  await fs.promises.mkdir(dir, { recursive: true });
  const relativo = `artes/${dataISO}-membro${membroId}-${sufixo}.jpg`;
  await fs.promises.writeFile(path.join(config.storage, relativo), buffer);
  return relativo;
}

/**
 * Gera e envia a arte de um membro e registra o envio.
 * status: 'enviado' (aniversário, conta para o dia) ou 'teste' (envio manual fora do dia).
 */
export async function enviarParaMembro(membro, dataAniversario, { status = 'enviado', tentativa = 1 } = {}) {
  const cfg = configuracao.todas();
  const resolver = criarResolvedor();
  const template = resolver(membro, dataAniversario);
  let arquivo = null;
  try {
    if (!cfg.grupo_whatsapp) throw new Error('Grupo do WhatsApp não configurado');
    const imagem = await gerarArte({ membro, template, dataAniversario, nomeMinisterio: cfg.nome_ministerio });
    arquivo = await salvarArte(imagem, membro.id, dataAniversario, status === 'teste' ? `teste${Date.now()}` : `t${tentativa}`);
    const legenda = montarLegenda(template.legenda, { membro, dataAniversario, nomeMinisterio: cfg.nome_ministerio });
    const idMensagem = await canal.enviarImagem(cfg.grupo_whatsapp, imagem, legenda);
    envios.registrar({
      membro_id: membro.id, template_id: template.id, data_aniversario: dataAniversario,
      status, tentativa, detalhe: idMensagem ? `Mensagem ${idMensagem}` : 'Enviado', arquivo_arte: arquivo,
    });
    return { ok: true, template, arquivo };
  } catch (erro) {
    envios.registrar({
      membro_id: membro.id, template_id: template?.id ?? null, data_aniversario: dataAniversario,
      status: status === 'teste' ? 'teste' : 'falhou', tentativa,
      detalhe: `${status === 'teste' ? 'Falhou: ' : ''}${erro.message}`, arquivo_arte: arquivo,
    });
    return { ok: false, erro: erro.message, template };
  }
}

/**
 * Um ciclo do disparo diário. Decisões:
 * 1) envio ativo? 2) já passou do horário? 3) WhatsApp conectado e grupo definido?
 * e, para cada aniversariante: 4) já recebeu hoje? 5) já falhou 3 vezes hoje?
 */
export async function executarCiclo({ agora = new Date(), ignorarHorario = false } = {}) {
  if (ocupado) return { executado: false, motivo: MOTIVO_OCUPADO, enviados: 0, falhas: 0, pulados: 0 };
  ocupado = true;
  const resultado = { executado: false, motivo: '', enviados: 0, falhas: 0, pulados: 0, quando: agora.toISOString() };
  try {
    const cfg = configuracao.todas();
    if (cfg.envio_ativo !== '1') return Object.assign(resultado, { motivo: 'Envio automático desativado' });
    if (!ignorarHorario && horaMinuto(agora) < cfg.horario_envio) {
      return Object.assign(resultado, { motivo: `Aguardando o horário (${cfg.horario_envio})` });
    }
    if (!canal.status().conectado) return Object.assign(resultado, { motivo: 'WhatsApp desconectado' });
    if (!cfg.grupo_whatsapp) return Object.assign(resultado, { motivo: 'Grupo do WhatsApp não configurado' });

    const hoje = hojeISO(agora);
    resultado.executado = true;
    let tentouEnviar = false;
    for (const membro of membros.aniversariantesDoDia(hoje)) {
      if (envios.jaEnviado(membro.id, hoje)) { resultado.pulados += 1; continue; }
      const falhas = envios.contarFalhas(membro.id, hoje);
      if (falhas >= config.maxTentativas) { resultado.pulados += 1; continue; }
      if (tentouEnviar) await pausar();
      tentouEnviar = true;
      // Uma falha não trava o ciclo: registra e segue para o próximo.
      const r = await enviarParaMembro(membro, hoje, { status: 'enviado', tentativa: falhas + 1 });
      if (r.ok) resultado.enviados += 1; else resultado.falhas += 1;
    }
    resultado.motivo = 'Ciclo concluído';
    return resultado;
  } finally {
    ocupado = false;
    ultimoCiclo = resultado;
  }
}

/** "Enviar agora" do cadastro: no dia do aniversário conta como o envio do dia; fora dele é um teste. */
export async function enviarAgora(membroId, agora = new Date()) {
  const membro = membros.obter(membroId);
  if (!membro) return { ok: false, erro: 'Membro não encontrado' };
  // Um ciclo pode levar minutos (pausas entre envios): em vez de prender a requisição, pede para tentar depois.
  if (ocupado) return { ok: false, erro: `${MOTIVO_OCUPADO}. Tente novamente em alguns minutos.` };
  ocupado = true;
  try {
    const hoje = hojeISO(agora);
    if (membro.ativo && ehAniversario(membro.data_nascimento, hoje) && !envios.jaEnviado(membro.id, hoje)) {
      const falhas = envios.contarFalhas(membro.id, hoje);
      if (falhas < config.maxTentativas) {
        return await enviarParaMembro(membro, hoje, { status: 'enviado', tentativa: falhas + 1 });
      }
    }
    return await enviarParaMembro(membro, proximoAniversario(membro.data_nascimento, hoje), { status: 'teste' });
  } finally {
    ocupado = false;
  }
}
