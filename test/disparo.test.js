import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aniv-'));
process.env.STORAGE_DIR = tmp;

const dados = await import('../src/modulos/dados/index.js');
const disparo = await import('../src/modulos/disparo/index.js');
const { gerarArte } = await import('../src/modulos/arte/index.js');
const sharp = (await import('sharp')).default;

const enviados = [];
let falhar = false;
const canalFalso = {
  status: () => ({ conectado: true }),
  enviarImagem: async (jid, imagem, legenda) => {
    if (falhar) throw new Error('timeout');
    enviados.push({ jid, tamanho: imagem.length, legenda });
    return `MSG${enviados.length}`;
  },
};

let pausas = 0;
const AGORA = new Date(2026, 10, 12, 9, 0); // 12/11/2026 09:00 local

before(() => {
  dados.abrir(':memory:');
  disparo.usarCanal(canalFalso);
  disparo.usarPausa(async () => { pausas += 1; });
  dados.configuracao.definir({ grupo_whatsapp: '123@g.us', horario_envio: '08:00', envio_ativo: '1' });
});
after(() => {
  dados.fechar();
  fs.rmSync(tmp, { recursive: true, force: true });
});
beforeEach(() => {
  enviados.length = 0;
  falhar = false;
  pausas = 0;
  dados.getDb().exec('DELETE FROM envio; DELETE FROM membro;');
});

test('envia uma vez por aniversariante e pula quem já recebeu', async () => {
  dados.membros.criar({ nome: 'Ana Souza', data_nascimento: '1996-11-12', sexo: 'F', ativo: 1 });
  dados.membros.criar({ nome: 'Lucas', data_nascimento: '2018-11-12', sexo: 'M', ativo: 1 });
  dados.membros.criar({ nome: 'Inativo', data_nascimento: '1990-11-12', sexo: 'M', ativo: 0 });
  dados.membros.criar({ nome: 'Outro dia', data_nascimento: '1990-11-13', sexo: 'M', ativo: 1 });

  const r1 = await disparo.executarCiclo({ agora: AGORA });
  assert.equal(r1.enviados, 2);
  assert.equal(enviados.length, 2);
  assert.equal(pausas, 1, 'pausa só entre os dois envios, não antes do primeiro');
  assert.match(enviados.find((e) => e.legenda.includes('Ana')).legenda, /30 anos/);
  assert.match(enviados.find((e) => e.legenda.includes('Lucas')).legenda, /8 aninhos/);

  const r2 = await disparo.executarCiclo({ agora: AGORA });
  assert.equal(r2.enviados, 0);
  assert.equal(r2.pulados, 2);
  assert.equal(enviados.length, 2);
});

test('não envia antes do horário', async () => {
  dados.membros.criar({ nome: 'Ana', data_nascimento: '1996-11-12', sexo: 'F', ativo: 1 });
  const r = await disparo.executarCiclo({ agora: new Date(2026, 10, 12, 7, 59) });
  assert.equal(r.executado, false);
  assert.equal(enviados.length, 0);
});

test('desiste depois de 3 falhas no dia', async () => {
  dados.membros.criar({ nome: 'Ana', data_nascimento: '1996-11-12', sexo: 'F', ativo: 1 });
  falhar = true;
  for (let i = 0; i < 4; i++) await disparo.executarCiclo({ agora: AGORA });
  const linhas = dados.getDb().prepare("SELECT status, tentativa FROM envio ORDER BY id").all();
  assert.deepEqual(linhas.map((l) => l.tentativa), [1, 2, 3]);
  assert.ok(linhas.every((l) => l.status === 'falhou'));
});

test('recupera depois de uma falha', async () => {
  dados.membros.criar({ nome: 'Ana', data_nascimento: '1996-11-12', sexo: 'F', ativo: 1 });
  falhar = true;
  await disparo.executarCiclo({ agora: AGORA });
  falhar = false;
  const r = await disparo.executarCiclo({ agora: AGORA });
  assert.equal(r.enviados, 1);
  const ultimo = dados.getDb().prepare('SELECT * FROM envio ORDER BY id DESC').get();
  assert.equal(ultimo.status, 'enviado');
  assert.equal(ultimo.tentativa, 2);
  assert.ok(fs.existsSync(path.join(tmp, ultimo.arquivo_arte)));
});

test('banco impede dois envios no mesmo aniversário', () => {
  const id = dados.membros.criar({ nome: 'Ana', data_nascimento: '1996-11-12', sexo: 'F', ativo: 1 });
  const e = { membro_id: id, data_aniversario: '2026-11-12', status: 'enviado' };
  dados.envios.registrar(e);
  assert.throws(() => dados.envios.registrar(e), /UNIQUE/);
});

test('arte tem 1080×1350 mesmo sem foto e sem fundo', async () => {
  const [template] = dados.templates.listar();
  const img = await gerarArte({
    membro: { nome: 'Maria Teste', data_nascimento: '1990-11-12', sexo: 'F', foto: null },
    template, dataAniversario: '2026-11-12', nomeMinisterio: 'Mídia',
  });
  const meta = await sharp(img).metadata();
  assert.equal(meta.width, 1080);
  assert.equal(meta.height, 1350);
  assert.equal(meta.format, 'jpeg');
});
