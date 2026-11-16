import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validar, membroExemplo } from '#modulos/templates/servico.js';

/** @type {import('#compartilhado/tipos.js').Template} */
const atual = {
  id: 1,
  tipo: 'feminino',
  nome: 'Feminino',
  fundo: null,
  cor_destaque: '#c2185b',
  mensagem_arte: '',
  legenda: '',
};

test('formulário do template mantém valores atuais quando inválidos', () => {
  const r = validar({ nome: '  ', cor_destaque: 'vermelho', mensagem_arte: 'a\r\nb\r\nc', legenda: 'x\r\ny' }, atual);
  assert.deepEqual(r, { nome: 'Feminino', cor_destaque: '#c2185b', mensagem_arte: 'a\nb', legenda: 'x\ny' });
  assert.equal(validar({ cor_destaque: '#ABCDEF' }, atual).cor_destaque, '#abcdef');
});

test('membro de exemplo faz aniversário hoje com a idade do tipo', () => {
  assert.equal(membroExemplo('infantil', '2026-11-16').data_nascimento, '2019-11-16');
  assert.equal(membroExemplo('feminino', '2028-02-29').data_nascimento, '2000-02-28');
});
