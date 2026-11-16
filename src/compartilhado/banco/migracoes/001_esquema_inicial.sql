-- Esquema inicial: membros, templates, envios e configuração.
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
