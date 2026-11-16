import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  idadeEm,
  aniversarioNoAno,
  proximoAniversario,
  ehAniversario,
  dataValida,
  diasEntre,
  somarDias,
  formatarDiaMes,
} from '../src/lib/datas.js';

test('idade em anos completos', () => {
  assert.equal(idadeEm('2000-11-12', '2026-11-12'), 26);
  assert.equal(idadeEm('2000-11-13', '2026-11-12'), 25);
  assert.equal(idadeEm('2015-01-01', '2026-11-12'), 11);
});

test('nascido em 29/02 comemora em 28/02 em ano não bissexto', () => {
  assert.equal(aniversarioNoAno('2012-02-29', 2026), '2026-02-28');
  assert.equal(aniversarioNoAno('2012-02-29', 2028), '2028-02-29');
  assert.ok(ehAniversario('2012-02-29', '2026-02-28'));
  assert.equal(idadeEm('2012-02-29', '2026-02-28'), 14);
});

test('próximo aniversário', () => {
  assert.equal(proximoAniversario('1990-11-12', '2026-11-12'), '2026-11-12');
  assert.equal(proximoAniversario('1990-11-11', '2026-11-12'), '2027-11-11');
  assert.equal(diasEntre('2026-12-30', '2027-01-02'), 3);
  assert.equal(somarDias('2026-12-31', 1), '2027-01-01');
});

test('validação da data de nascimento', () => {
  assert.ok(dataValida('2000-02-29', '2026-11-12'));
  assert.ok(!dataValida('2001-02-29', '2026-11-12'));
  assert.ok(!dataValida('2030-01-01', '2026-11-12'));
  assert.ok(!dataValida('12/11/2000', '2026-11-12'));
  assert.equal(formatarDiaMes('2026-03-05'), '5 de março');
});
