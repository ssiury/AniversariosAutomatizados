import { test } from 'node:test';
import assert from 'node:assert/strict';
import { descreverEnvio } from '#modulos/disparo/apresentacao.js';
import { montarCalendario, proximoEnvio } from '#modulos/painel/dashboard.js';
import { agruparPorDia } from '#modulos/painel/rotas.js';
import { formatarWhatsapp } from '#compartilhado/views.js';
import { diaSemana, diaSemanaCurto, ehFimDeSemana } from '#compartilhado/datas.js';

const base = { membro_nome: 'Ana', template_nome: 'Feminino', tentativa: 2 };

test('cada tipo de envio vira um evento legível', () => {
  assert.deepEqual(descreverEnvio({ ...base, status: 'enviado', detalhe: 'Mensagem 3EB0' }), {
    tipo: 'sucesso',
    titulo: 'Arte enviada ao grupo',
    descricao: 'Ana · Feminino',
    rotulo: 'Aniversário',
    referencia: '3EB0',
  });
  const falha = descreverEnvio({ ...base, status: 'falhou', detalhe: 'Timed Out' });
  assert.equal(falha.tipo, 'falha');
  assert.equal(falha.descricao, 'Ana · Timed Out');
  assert.equal(falha.referencia, 'Tentativa 2 de 3');
  const testeFalhou = descreverEnvio({ ...base, status: 'teste', detalhe: 'Falhou: WhatsApp não está conectado' });
  assert.equal(testeFalhou.titulo, 'Teste falhou');
  assert.equal(testeFalhou.descricao, 'Ana · WhatsApp não está conectado');
  assert.equal(descreverEnvio({ ...base, status: 'teste', detalhe: 'Enviado' }).titulo, 'Teste enviado');
});

test('dias da semana e fim de semana', () => {
  assert.equal(diaSemana('2026-11-16'), 'segunda-feira');
  assert.equal(diaSemanaCurto('2026-11-21'), 'sáb');
  assert.equal(ehFimDeSemana('2026-11-22'), true);
  assert.equal(ehFimDeSemana('2026-11-23'), false);
});

test('calendário de 14 dias com os aniversariantes de cada data', () => {
  const ativos = [
    { id: 1, nome: 'Ana', proximo_aniversario: '2026-11-16' },
    { id: 2, nome: 'Rui', proximo_aniversario: '2026-11-29' },
    { id: 3, nome: 'Fora', proximo_aniversario: '2026-11-30' },
  ];
  const dias = montarCalendario(ativos, '2026-11-16');
  assert.equal(dias.length, 14);
  assert.equal(dias[0].hoje, true);
  assert.deepEqual(
    dias[0].membros.map((m) => m.id),
    [1],
  );
  assert.deepEqual(
    dias[13].membros.map((m) => m.id),
    [2],
  );
  assert.equal(dias.flatMap((d) => d.membros).length, 2);
  assert.equal(dias[5].fimDeSemana, true); // 21/11 é sábado
});

test('próximo envio é hoje antes do horário e amanhã depois dele', () => {
  const cfg = { horario_envio: '08:00', envio_ativo: '1' };
  assert.equal(proximoEnvio(cfg, new Date(2026, 10, 16, 7, 0), '2026-11-16').quando, 'Hoje');
  const depois = proximoEnvio(cfg, new Date(2026, 10, 16, 9, 0), '2026-11-16');
  assert.deepEqual([depois.quando, depois.data, depois.diaSemana], ['Amanhã', '2026-11-17', 'terça-feira']);
});

test('histórico agrupado por dia, com "Hoje" e "Ontem"', () => {
  const linhas = [
    { ...base, status: 'enviado', criado_em: '2026-11-16 10:00:00' },
    { ...base, status: 'enviado', criado_em: '2026-11-16 08:00:00' },
    { ...base, status: 'falhou', criado_em: '2026-11-15 08:00:00' },
    { ...base, status: 'teste', criado_em: '2026-11-02 08:00:00' },
  ];
  const grupos = agruparPorDia(linhas, '2026-11-16');
  assert.deepEqual(
    grupos.map((g) => [g.data, g.relativo, g.envios.length]),
    [
      ['2026-11-16', 'Hoje', 2],
      ['2026-11-15', 'Ontem', 1],
      ['2026-11-02', '', 1],
    ],
  );
  assert.equal(grupos[1].envios[0].evento.tipo, 'falha');
});

test('prévia do WhatsApp aplica a formatação sem permitir HTML', () => {
  assert.equal(formatarWhatsapp('Oi *João*\n_bom_ ~dia~'), 'Oi <b>João</b><br><i>bom</i> <s>dia</s>');
  assert.equal(formatarWhatsapp('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(formatarWhatsapp('*<b>*'), '<b>&lt;b&gt;</b>');
  assert.equal(formatarWhatsapp('nome_de_usuario'), 'nome_de_usuario');
});
