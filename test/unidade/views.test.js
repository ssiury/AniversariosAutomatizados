import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { helpers } from '#compartilhado/views.js';
import { ICONES, icone } from '#compartilhado/icones.js';

test('todos os ícones da lista foram copiados para views/icones', () => {
  for (const nome of ICONES) {
    assert.ok(fs.existsSync(path.join(import.meta.dirname, '../../views/icones', `${nome}.svg`)), nome);
  }
});

test('ícone vira SVG inline acessível, sem o comentário de licença', () => {
  const svg = icone('users', 'grande');
  assert.match(svg, /^<svg class="icone grande" viewBox="0 0 24 24"/);
  assert.match(svg, /aria-hidden="true"/);
  assert.doesNotMatch(svg, /<!--|@license/);
  assert.throws(() => icone('nao-existe'), /Ícone desconhecido/);
  assert.throws(() => icone('../../package'), /Ícone desconhecido/);
});

test('iniciais só contêm letras', () => {
  assert.equal(helpers.iniciais('Maria da Silva'), 'MS');
  assert.equal(helpers.iniciais('joão'), 'J');
  assert.equal(helpers.iniciais('<script>alert(1)</script>'), 'S');
  assert.equal(helpers.iniciais('   '), '?');
});
