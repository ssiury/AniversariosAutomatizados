import Database from 'better-sqlite3';

let db;

const MIGRACOES = [
  // v1 — esquema inicial
  `
  CREATE TABLE template (
    id            INTEGER PRIMARY KEY,
    tipo          TEXT NOT NULL UNIQUE CHECK (tipo IN ('masculino', 'feminino', 'infantil')),
    nome          TEXT NOT NULL,
    fundo         TEXT,
    cor_destaque  TEXT NOT NULL DEFAULT '#1565c0',
    mensagem_arte TEXT NOT NULL DEFAULT '',
    legenda       TEXT NOT NULL DEFAULT '',
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE membro (
    id               INTEGER PRIMARY KEY,
    nome             TEXT NOT NULL CHECK (length(trim(nome)) > 0),
    data_nascimento  TEXT NOT NULL CHECK (data_nascimento GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    sexo             TEXT NOT NULL CHECK (sexo IN ('M', 'F')),
    ativo            INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
    foto             TEXT,
    template_fixo_id INTEGER REFERENCES template(id) ON DELETE SET NULL,
    criado_em        TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    atualizado_em    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE envio (
    id               INTEGER PRIMARY KEY,
    membro_id        INTEGER NOT NULL REFERENCES membro(id) ON DELETE CASCADE,
    template_id      INTEGER REFERENCES template(id),
    data_aniversario TEXT NOT NULL,
    status           TEXT NOT NULL CHECK (status IN ('enviado', 'falhou', 'teste')),
    tentativa        INTEGER NOT NULL DEFAULT 1 CHECK (tentativa BETWEEN 1 AND 3),
    detalhe          TEXT,
    arquivo_arte     TEXT,
    criado_em        TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE INDEX idx_envio_membro_data ON envio (membro_id, data_aniversario);
  -- Garante no banco que um membro não recebe duas artes no mesmo aniversário.
  CREATE UNIQUE INDEX uq_envio_enviado ON envio (membro_id, data_aniversario) WHERE status = 'enviado';
  CREATE INDEX idx_envio_criado ON envio (criado_em);

  CREATE TABLE configuracao (
    chave TEXT PRIMARY KEY,
    valor TEXT
  );
  `,
];

const TEMPLATES_PADRAO = [
  {
    tipo: 'masculino',
    nome: 'Masculino',
    cor_destaque: '#1565c0',
    mensagem_arte: 'Que Deus abençoe\nseu novo ano de vida!',
    legenda:
      '🎉 Hoje é aniversário do *{nome}*!\nParabéns pelos {idade} anos. Que Deus te abençoe grandemente!\n\n— {ministerio}',
  },
  {
    tipo: 'feminino',
    nome: 'Feminino',
    cor_destaque: '#c2185b',
    mensagem_arte: 'Que Deus abençoe\nseu novo ano de vida!',
    legenda:
      '🎉 Hoje é aniversário da *{nome}*!\nParabéns pelos {idade} anos. Que Deus te abençoe grandemente!\n\n— {ministerio}',
  },
  {
    tipo: 'infantil',
    nome: 'Infantil',
    cor_destaque: '#ef6c00',
    mensagem_arte: 'Hoje é dia de festa!\nDeus te ama muito!',
    legenda:
      '🎈 Hoje é dia de festa! *{nome}* está fazendo {idade} aninhos!\nQue Jesus encha sua vida de alegria!\n\n— {ministerio}',
  },
];

export const CONFIG_PADRAO = {
  envio_ativo: '1',
  grupo_whatsapp: '',
  grupo_whatsapp_nome: '',
  horario_envio: '08:00',
  idade_limite_infantil: '12',
  nome_ministerio: 'Ministério de Mídia',
};

function migrar() {
  const versao = db.pragma('user_version', { simple: true });
  for (let v = versao; v < MIGRACOES.length; v++) {
    db.transaction(() => {
      db.exec(MIGRACOES[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }

  const insTemplate = db.prepare(`INSERT OR IGNORE INTO template (tipo, nome, cor_destaque, mensagem_arte, legenda)
    VALUES (@tipo, @nome, @cor_destaque, @mensagem_arte, @legenda)`);
  const insConfig = db.prepare('INSERT OR IGNORE INTO configuracao (chave, valor) VALUES (?, ?)');
  db.transaction(() => {
    TEMPLATES_PADRAO.forEach((t) => insTemplate.run(t));
    Object.entries(CONFIG_PADRAO).forEach(([k, v]) => insConfig.run(k, v));
  })();
}

export function abrir(arquivo) {
  db = new Database(arquivo);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrar();
  return db;
}

export function getDb() {
  if (!db) throw new Error('Banco de dados não foi aberto');
  return db;
}

export function fechar() {
  db?.close();
  db = undefined;
}

export * as membros from './membros.js';
export * as templates from './templates.js';
export * as envios from './envios.js';
export * as configuracao from './configuracao.js';
