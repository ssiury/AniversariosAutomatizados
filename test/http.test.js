import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aniv-http-'));
process.env.STORAGE_DIR = tmp;

const dados = await import('../src/modulos/dados/index.js');
const { criarApp } = await import('../src/app.js');

/** @type {import('express').Express} */
let app;
/** @type {import('supertest').Agent} */
let logado;

before(async () => {
  dados.abrir(':memory:');
  app = criarApp();
  logado = request.agent(app);
  await logado.post('/login').type('form').send({ usuario: 'admin', senha: 'admin' }).expect(302);
});
after(() => {
  dados.fechar();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('healthcheck é público e confere o banco', async () => {
  const r = await request(app).get('/saude').expect(200);
  assert.deepEqual(r.body, { ok: true });
});

test('cabeçalhos de segurança em todas as respostas', async () => {
  const r = await request(app).get('/login');
  assert.equal(r.headers['x-frame-options'], 'DENY');
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
  assert.equal(r.headers['x-powered-by'], undefined);
});

test('sem login, o painel redireciona (ou responde 401 ao htmx)', async () => {
  await request(app).get('/').expect(302).expect('Location', '/login');
  await request(app).get('/membros').set('HX-Request', 'true').expect(401).expect('HX-Redirect', '/login');
});

test('login inválido responde 401 e bloqueia após 5 erros', async () => {
  const tentar = () =>
    request(app)
      .post('/login')
      .set('X-Forwarded-For', '203.0.113.9')
      .type('form')
      .send({ usuario: 'admin', senha: 'errada' });
  for (let i = 0; i < 5; i++) await tentar().expect(401);
  await tentar().expect(429);
});

test('logado, as telas principais abrem', async () => {
  for (const rota of ['/', '/membros', '/membros/novo', '/templates', '/historico', '/configuracoes']) {
    await logado.get(rota).expect(200).expect('Content-Type', /html/);
  }
});

test('cadastro de membro: valida, cria, lista e exclui', async () => {
  await logado.post('/membros').type('form').send({ nome: '', data_nascimento: 'x', sexo: '' }).expect(422);

  const r = await logado
    .post('/membros')
    .type('form')
    .send({ nome: 'Ana Teste', data_nascimento: '1990-05-10', sexo: 'F', ativo: 'on' })
    .expect(302);
  const id = Number(r.headers.location.match(/\/membros\/(\d+)/)[1]);
  assert.equal(dados.membros.obter(id).nome, 'Ana Teste');

  const linhas = await logado.get('/membros?busca=Ana').set('HX-Request', 'true').expect(200);
  assert.match(linhas.text, /Ana Teste/);
  assert.doesNotMatch(linhas.text, /<html/, 'requisição htmx recebe só o fragmento');

  await logado.post(`/membros/${id}/excluir`).expect(302);
  assert.equal(dados.membros.obter(id), undefined);
  await logado.get(`/membros/${id}`).expect(404);
});

test('prévia da arte é gerada como JPEG', async () => {
  const [template] = dados.templates.listar();
  await logado.get(`/templates/${template.id}/previa.jpg?w=200`).expect(200).expect('Content-Type', /jpeg/);
});

test('configurações: rejeita valores inválidos e salva os válidos', async () => {
  await logado
    .post('/configuracoes')
    .type('form')
    .send({ horario_envio: '25:00', idade_limite_infantil: '12', nome_ministerio: 'Mídia' })
    .expect(422);
  await logado
    .post('/configuracoes')
    .type('form')
    .send({ horario_envio: '09:30', idade_limite_infantil: '10', nome_ministerio: 'Mídia', envio_ativo: 'on' })
    .expect(302);
  assert.equal(dados.configuracao.obter('horario_envio'), '09:30');
  assert.equal(dados.configuracao.obter('idade_limite_infantil'), '10');
});

test('sessão do WhatsApp e banco nunca são servidos', async () => {
  fs.mkdirSync(path.join(tmp, 'whatsapp'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'whatsapp', 'creds.json'), '{}');
  await logado.get('/storage/whatsapp/creds.json').expect(404);
  await logado.get('/storage/dados.sqlite').expect(404);
  await logado.get('/storage/fotos/../whatsapp/creds.json').expect(403);
});
