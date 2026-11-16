import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { listarMigracoes, abrir, fechar, getDb } from '#compartilhado/banco/index.js';
import { TEMPLATES_PADRAO } from '#modulos/templates/servico.js';

test('migrações são sequenciais a partir de 001', () => {
  const versoes = listarMigracoes().map((m) => m.versao);
  assert.deepEqual(
    versoes,
    versoes.map((_, i) => i + 1),
  );
});

test('rejeita migração fora de sequência', () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
  fs.writeFileSync(path.join(pasta, '001_a.sql'), 'SELECT 1;');
  fs.writeFileSync(path.join(pasta, '003_c.sql'), 'SELECT 1;');
  assert.throws(() => listarMigracoes(pasta), /fora de sequência/);
  fs.rmSync(pasta, { recursive: true });
});

test('banco novo recebe o esquema e os 3 templates', () => {
  abrir(':memory:');
  const db = getDb();
  assert.equal(db.pragma('user_version', { simple: true }), listarMigracoes().length);
  const tipos = db.prepare('SELECT tipo FROM template ORDER BY tipo').pluck().all();
  assert.deepEqual(tipos, ['feminino', 'infantil', 'masculino']);
  fechar();
});

test('banco existente na versão 1 é atualizado sem duplicar nem alterar templates', () => {
  const arquivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mig-')), 'dados.sqlite');
  const antigo = new Database(arquivo);
  antigo.exec(listarMigracoes()[0].sql);
  antigo.prepare("INSERT INTO template (tipo, nome) VALUES ('masculino', 'Editado pelo usuário')").run();
  antigo.pragma('user_version = 1');
  antigo.close();

  abrir(arquivo);
  const linhas = /** @type {{ tipo: string, nome: string }[]} */ (
    getDb().prepare('SELECT tipo, nome FROM template ORDER BY tipo').all()
  );
  assert.equal(linhas.length, 3);
  assert.deepEqual(
    { ...linhas.find((l) => l.tipo === 'masculino') },
    { tipo: 'masculino', nome: 'Editado pelo usuário' },
  );
  fechar();
  fs.rmSync(path.dirname(arquivo), { recursive: true });
});

test('"Restaurar padrão" usa os mesmos valores com que a migração cria os templates', () => {
  abrir(':memory:');
  const linhas = /** @type {any[]} */ (
    getDb().prepare('SELECT tipo, nome, cor_destaque, mensagem_arte, legenda FROM template').all()
  );
  for (const { tipo, ...valores } of linhas) assert.deepEqual(valores, TEMPLATES_PADRAO[tipo], tipo);
  fechar();
});
