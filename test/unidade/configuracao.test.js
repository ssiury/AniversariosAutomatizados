import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validar, nomeDoGrupo } from '#modulos/configuracao/servico.js';

test('valida horário, idade limite e nome do ministério', () => {
  const ok = validar({
    horario_envio: '07:45',
    idade_limite_infantil: '10',
    nome_ministerio: ' Mídia ',
    envio_ativo: 'on',
  });
  assert.deepEqual(ok.erros, {});
  assert.deepEqual(ok.valores, {
    envio_ativo: '1',
    horario_envio: '07:45',
    idade_limite_infantil: '10',
    nome_ministerio: 'Mídia',
  });

  const ruim = validar({ horario_envio: '24:00', idade_limite_infantil: '19', nome_ministerio: '' });
  assert.deepEqual(Object.keys(ruim.erros).sort(), ['horario_envio', 'idade_limite_infantil', 'nome_ministerio']);
  assert.equal(ruim.valores.envio_ativo, '0');
});

test('nome do grupo vem da lista, do valor salvo ou do próprio id', () => {
  const grupos = [{ id: '1@g.us', nome: 'Mídia' }];
  const atual = { grupo_whatsapp: '2@g.us', grupo_whatsapp_nome: 'Antigo' };
  assert.equal(nomeDoGrupo('1@g.us', grupos, atual), 'Mídia');
  assert.equal(nomeDoGrupo('2@g.us', [], atual), 'Antigo');
  assert.equal(nomeDoGrupo('3@g.us', [], atual), '3@g.us');
});
