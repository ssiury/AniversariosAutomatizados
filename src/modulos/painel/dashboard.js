import * as membros from '#modulos/membros/index.js';
import * as configuracao from '#modulos/configuracao/index.js';
import * as disparo from '#modulos/disparo/index.js';
import * as whatsapp from '#modulos/whatsapp/index.js';
import { hojeISO, horaMinuto, partes, somarDias } from '#compartilhado/datas.js';

export function montarDashboard(agora = new Date()) {
  const hoje = hojeISO(agora);
  const cfg = configuracao.todas();
  const ativos = membros.listarDetalhado({ situacao: 'ativo' }, hoje);

  const deHoje = ativos
    .filter((m) => m.dias_ate === 0)
    .map((m) => ({
      ...m,
      situacao: disparo.situacaoDoDia(m.id, hoje),
    }));
  const proximos7 = ativos.filter((m) => m.dias_ate >= 1 && m.dias_ate <= 7).sort((a, b) => a.dias_ate - b.dias_ate);
  const mesAtual = partes(hoje).m;
  const doMes = ativos
    .filter((m) => partes(m.data_nascimento).m === mesAtual)
    .sort((a, b) => partes(a.data_nascimento).d - partes(b.data_nascimento).d);

  const porTemplate = { masculino: 0, feminino: 0, infantil: 0 };
  for (const m of ativos) if (m.template) porTemplate[m.template.tipo] += 1;

  const wa = whatsapp.status();
  let proximoEnvio;
  if (cfg.envio_ativo !== '1') proximoEnvio = 'Envio automático desativado';
  else if (horaMinuto(agora) < cfg.horario_envio) proximoEnvio = `Hoje às ${cfg.horario_envio}`;
  else
    proximoEnvio = `Amanhã (${somarDias(hoje, 1).split('-').reverse().slice(0, 2).join('/')}) às ${cfg.horario_envio}`;

  return {
    hoje,
    mesAtual,
    deHoje,
    proximos7,
    doMes,
    totais: membros.contar(),
    porTemplate,
    saude: {
      whatsapp: wa,
      grupo: cfg.grupo_whatsapp ? cfg.grupo_whatsapp_nome || cfg.grupo_whatsapp : null,
      proximoEnvio,
      envioAtivo: cfg.envio_ativo === '1',
    },
    ultimos: disparo.ultimosEnvios(5),
  };
}
