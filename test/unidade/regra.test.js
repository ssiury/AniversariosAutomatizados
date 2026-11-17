import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escolherTemplate, montarLegenda } from '#modulos/templates/regra.js';

const templates = [
  { id: 1, tipo: 'masculino', legenda: '' },
  { id: 2, tipo: 'feminino', legenda: '' },
  { id: 3, tipo: 'infantil', legenda: '' },
];
const opts = { dataAniversario: '2026-11-12', idadeLimiteInfantil: 12 };

test('template fixo vence todas as regras', () => {
  const m = { data_nascimento: '2016-11-12', sexo: 'M', template_fixo_id: 1 };
  assert.equal(escolherTemplate(m, templates, opts).tipo, 'masculino');
});

test('idade abaixo do limite recebe infantil', () => {
  assert.equal(escolherTemplate({ data_nascimento: '2015-11-12', sexo: 'F' }, templates, opts).tipo, 'infantil'); // 11
  assert.equal(escolherTemplate({ data_nascimento: '2014-11-12', sexo: 'F' }, templates, opts).tipo, 'feminino'); // 12
});

test('sexo decide depois da idade', () => {
  assert.equal(escolherTemplate({ data_nascimento: '1990-11-12', sexo: 'M' }, templates, opts).tipo, 'masculino');
  assert.equal(escolherTemplate({ data_nascimento: '1990-11-12', sexo: 'F' }, templates, opts).tipo, 'feminino');
});

test('limite infantil configurável', () => {
  const m = { data_nascimento: '2013-11-12', sexo: 'M' }; // 13 anos
  assert.equal(escolherTemplate(m, templates, { ...opts, idadeLimiteInfantil: 14 }).tipo, 'infantil');
});

test('template fixo inexistente cai na regra', () => {
  const m = { data_nascimento: '1990-11-12', sexo: 'F', template_fixo_id: 99 };
  assert.equal(escolherTemplate(m, templates, opts).tipo, 'feminino');
});

test('legenda substitui variáveis', () => {
  const legenda = montarLegenda('Parabéns {nome}, {idade} anos em {data}! — {ministerio} {outro}', {
    membro: { nome: 'Ana', data_nascimento: '1996-11-12' },
    dataAniversario: '2026-11-12',
    nomeMinisterio: 'Mídia',
  });
  assert.equal(legenda, 'Parabéns Ana, 30 anos em 12 de novembro! — Mídia {outro}');
});
