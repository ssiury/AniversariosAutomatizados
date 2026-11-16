import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliarCiclo, reportarCiclo } from '../src/modulos/monitor/index.js';

const cicloOk = { executado: true, motivo: 'Ciclo concluído', enviados: 1, falhas: 0, pulados: 0 };

test('ciclo sem falhas é saudável', () => {
  assert.equal(avaliarCiclo(cicloOk, { conectado: true }), 'ok');
  assert.equal(avaliarCiclo({ executado: false, motivo: 'Aguardando o horário (08:00)' }, { conectado: true }), 'ok');
  assert.equal(avaliarCiclo({ executado: false, motivo: 'Envio automático desativado' }), 'ok');
});

test('falha de envio, WhatsApp fora ou grupo ausente geram alerta', () => {
  assert.equal(avaliarCiclo({ ...cicloOk, falhas: 1 }), 'falha');
  assert.equal(avaliarCiclo({ executado: false, motivo: 'Grupo do WhatsApp não configurado' }), 'falha');
  assert.equal(
    avaliarCiclo({ executado: false, motivo: 'Aguardando o horário (08:00)' }, { conectado: false }),
    'falha',
  );
  assert.equal(avaliarCiclo(cicloOk, { conectado: false, desativado: true }), 'ok');
});

test('envia o ping para a URL certa e nunca lança', async () => {
  const chamadas = [];
  const enviar = async (url) => {
    chamadas.push(url);
  };
  await reportarCiclo(cicloOk, { url: 'https://hc/abc', enviar });
  await reportarCiclo({ ...cicloOk, falhas: 2 }, { url: 'https://hc/abc/', enviar });
  await reportarCiclo(cicloOk, { url: '', enviar });
  assert.deepEqual(chamadas, ['https://hc/abc', 'https://hc/abc/fail']);

  await assert.doesNotReject(
    reportarCiclo(cicloOk, {
      url: 'https://hc/abc',
      enviar: async () => {
        throw new Error('rede fora');
      },
    }),
  );
});
