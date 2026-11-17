import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aniv-'));
process.env.STORAGE_DIR = tmp;

const banco = await import('#compartilhado/banco/index.js');
/** Linha do banco nos testes (sem tipo). @type {(sql: string) => { get: (...a: any[]) => any, all: (...a: any[]) => any[] }} */
const sql = (texto) => banco.getDb().prepare(texto);
const membros = await import('#modulos/membros/repositorio.js');
const templates = await import('#modulos/templates/repositorio.js');
const envios = await import('#modulos/disparo/repositorio.js');
const configuracao = await import('#modulos/configuracao/repositorio.js');
const disparo = await import('#modulos/disparo/index.js');
const { gerarArte } = await import('#modulos/arte/index.js');
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
  banco.abrir(':memory:');
  disparo.usarCanal(canalFalso);
  disparo.usarPausa(async () => {
    pausas += 1;
  });
  configuracao.definir({ grupo_whatsapp: '123@g.us', horario_envio: '08:00', envio_ativo: '1' });
});
after(() => {
  banco.fechar();
  fs.rmSync(tmp, { recursive: true, force: true });
});
beforeEach(() => {
  enviados.length = 0;
  falhar = false;
  pausas = 0;
  banco.getDb().exec('DELETE FROM envio; DELETE FROM membro;');
});

test('envia uma vez por aniversariante e pula quem já recebeu', async () => {
  membros.criar({ nome: 'Ana Souza', data_nascimento: '1996-11-12', sexo: 'F', ativo: 1 });
  membros.criar({ nome: 'Lucas', data_nascimento: '2018-11-12', sexo: 'M', ativo: 1 });
  membros.criar({ nome: 'Inativo', data_nascimento: '1990-11-12', sexo: 'M', ativo: 0 });
  membros.criar({ nome: 'Outro dia', data_nascimento: '1990-11-13', sexo: 'M', ativo: 1 });

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
  membros.criar({ nome: 'Ana', data_nascimento: '1996-11-12', sexo: 'F', ativo: 1 });
  const r = await disparo.executarCiclo({ agora: new Date(2026, 10, 12, 7, 59) });
  assert.equal(r.executado, false);
  assert.equal(enviados.length, 0);
});

test('desiste depois de 3 falhas no dia', async () => {
  membros.criar({ nome: 'Ana', data_nascimento: '1996-11-12', sexo: 'F', ativo: 1 });
  falhar = true;
  for (let i = 0; i < 4; i++) await disparo.executarCiclo({ agora: AGORA });
  const linhas = sql('SELECT status, tentativa FROM envio ORDER BY id').all();
  assert.deepEqual(
    linhas.map((l) => l.tentativa),
    [1, 2, 3],
  );
  assert.ok(linhas.every((l) => l.status === 'falhou'));
});

test('recupera depois de uma falha', async () => {
  membros.criar({ nome: 'Ana', data_nascimento: '1996-11-12', sexo: 'F', ativo: 1 });
  falhar = true;
  await disparo.executarCiclo({ agora: AGORA });
  falhar = false;
  const r = await disparo.executarCiclo({ agora: AGORA });
  assert.equal(r.enviados, 1);
  const ultimo = sql('SELECT * FROM envio ORDER BY id DESC').get();
  assert.equal(ultimo.status, 'enviado');
  assert.equal(ultimo.tentativa, 2);
  assert.ok(fs.existsSync(path.join(tmp, ultimo.arquivo_arte)));
});

test('banco impede dois envios no mesmo aniversário', () => {
  const id = membros.criar({ nome: 'Ana', data_nascimento: '1996-11-12', sexo: 'F', ativo: 1 });
  const e = { membro_id: id, data_aniversario: '2026-11-12', status: 'enviado' };
  envios.registrar(e);
  assert.throws(() => envios.registrar(e), /UNIQUE/);
});

test('arte tem 1080×1350 mesmo sem foto e sem fundo', async () => {
  const [template] = templates.listar();
  const img = await gerarArte({
    membro: { nome: 'Maria Teste', data_nascimento: '1990-11-12', sexo: 'F', foto: null },
    template,
    dataAniversario: '2026-11-12',
    nomeMinisterio: 'Mídia',
  });
  const meta = await sharp(img).metadata();
  assert.equal(meta.width, 1080);
  assert.equal(meta.height, 1350);
  assert.equal(meta.format, 'jpeg');
});

test('"Enviar agora" no dia do aniversário conta como o envio do dia', async () => {
  const id = membros.criar({ nome: 'Ana', data_nascimento: '1996-11-12', sexo: 'F', ativo: 1 });
  const r = await disparo.enviarAgora(id, AGORA);
  assert.equal(r.ok, true);
  const ciclo = await disparo.executarCiclo({ agora: AGORA });
  assert.equal(ciclo.pulados, 1, 'o ciclo não repete o envio');
  assert.equal(enviados.length, 1);
});

test('"Enviar agora" fora do dia é registrado como teste', async () => {
  const id = membros.criar({ nome: 'Ana', data_nascimento: '1996-03-01', sexo: 'F', ativo: 1 });
  await disparo.enviarAgora(id, AGORA);
  const linha = sql('SELECT status, data_aniversario FROM envio').get();
  assert.deepEqual({ ...linha }, { status: 'teste', data_aniversario: '2027-03-01' });
});

test('"Enviar agora" e o ciclo nunca enviam ao mesmo tempo', async () => {
  membros.criar({ nome: 'Ana', data_nascimento: '1996-11-12', sexo: 'F', ativo: 1 });
  const id = membros.criar({ nome: 'Bia', data_nascimento: '1990-11-12', sexo: 'F', ativo: 1 });
  /** @type {((valor?: unknown) => void) | undefined} */
  let liberar;
  disparo.usarPausa(
    () =>
      new Promise((r) => {
        liberar = r;
      }),
  );
  const ciclo = disparo.executarCiclo({ agora: AGORA }); // fica parado na pausa entre os dois envios
  await new Promise((r) => setImmediate(r));
  while (!liberar) await new Promise((r) => setTimeout(r, 10));

  const manual = await disparo.enviarAgora(id, AGORA);
  assert.equal(manual.ok, false);
  assert.match(manual.erro, /envio em andamento/);
  assert.equal((await disparo.executarCiclo({ agora: AGORA })).motivo, disparo.MOTIVO_OCUPADO);

  liberar();
  assert.equal((await ciclo).enviados, 2);
  assert.equal(enviados.length, 2);
  disparo.usarPausa(async () => {
    pausas += 1;
  });
});
