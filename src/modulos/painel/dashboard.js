import * as membros from '#modulos/membros/index.js';
import * as templates from '#modulos/templates/index.js';
import * as configuracao from '#modulos/configuracao/index.js';
import * as disparo from '#modulos/disparo/index.js';
import * as whatsapp from '#modulos/whatsapp/index.js';
import {
  hojeISO,
  horaMinuto,
  partes,
  somarDias,
  diaSemana,
  diaSemanaCurto,
  ehFimDeSemana,
} from '#compartilhado/datas.js';

const DIAS_CALENDARIO = 14;

/** Dias de hoje em diante, cada um com os aniversariantes ativos daquela data. */
export function montarCalendario(ativos, hoje, dias = DIAS_CALENDARIO) {
  return Array.from({ length: dias }, (_, i) => {
    const data = somarDias(hoje, i);
    return {
      data,
      dia: partes(data).d,
      semana: diaSemanaCurto(data),
      hoje: i === 0,
      fimDeSemana: ehFimDeSemana(data),
      membros: ativos.filter((m) => m.proximo_aniversario === data),
    };
  });
}

/** Quando acontece o próximo envio automático. */
export function proximoEnvio(cfg, agora, hoje) {
  const ehHoje = horaMinuto(agora) < cfg.horario_envio;
  const data = ehHoje ? hoje : somarDias(hoje, 1);
  return {
    hora: cfg.horario_envio,
    quando: ehHoje ? 'Hoje' : 'Amanhã',
    diaSemana: diaSemana(data),
    data,
    ativo: cfg.envio_ativo === '1',
  };
}

export function montarDashboard(agora = new Date()) {
  const hoje = hojeISO(agora);
  const cfg = configuracao.todas();
  const ativos = membros.listarDetalhado({ situacao: 'ativo' }, hoje);

  const deHoje = ativos
    .filter((m) => m.dias_ate === 0)
    .map((m) => ({ ...m, situacao: disparo.situacaoDoDia(m.id, hoje), envio: disparo.ultimoDoDia(m.id, hoje) }));

  const mesAtual = partes(hoje).m;
  const doMes = ativos
    .filter((m) => partes(m.data_nascimento).m === mesAtual)
    .sort((a, b) => partes(a.data_nascimento).d - partes(b.data_nascimento).d);

  const contagem = { masculino: 0, feminino: 0, infantil: 0 };
  for (const m of ativos) if (m.template) contagem[m.template.tipo] += 1;
  const porTemplate = templates.listar().map((t) => ({ ...t, total: contagem[t.tipo] ?? 0 }));

  return {
    hoje,
    diaSemana: diaSemana(hoje),
    mesAtual,
    deHoje,
    proximos7: ativos.filter((m) => m.dias_ate >= 1 && m.dias_ate <= 7).length,
    calendario: montarCalendario(ativos, hoje),
    doMes,
    totais: membros.contar(),
    porTemplate,
    maiorTemplate: Math.max(1, ...porTemplate.map((t) => t.total)),
    envio: proximoEnvio(cfg, agora, hoje),
    grupo: cfg.grupo_whatsapp ? cfg.grupo_whatsapp_nome || cfg.grupo_whatsapp : null,
    whatsapp: whatsapp.status(),
    atividade: disparo.ultimosEnvios(5).map((e) => ({ ...e, evento: disparo.descreverEnvio(e) })),
  };
}
