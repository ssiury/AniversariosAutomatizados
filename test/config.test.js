import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarConfig, verificarConfig } from '../src/config.js';

test('desenvolvimento funciona sem nenhuma variável', () => {
  const { erros } = verificarConfig(carregarConfig({}));
  assert.deepEqual(erros, []);
});

test('produção exige senha e segredo', () => {
  const { erros } = verificarConfig(carregarConfig({ NODE_ENV: 'production' }));
  assert.equal(erros.length, 2);
});

test('rejeita números e URLs inválidos', () => {
  const { erros } = verificarConfig(
    carregarConfig({ PORTA: 'abc', INTERVALO_CICLO_MIN: '0', MONITOR_URL: 'não é url', LOG_NIVEL: 'tudo' }),
  );
  assert.equal(erros.length, 4);
});

test('avisa sobre configuração fraca em produção', () => {
  const { erros, avisos } = verificarConfig(
    carregarConfig({ NODE_ENV: 'production', ADMIN_SENHA: 'curta', SESSAO_SEGREDO: 'curto' }),
  );
  assert.deepEqual(erros, []);
  assert.equal(avisos.length, 3);
});
