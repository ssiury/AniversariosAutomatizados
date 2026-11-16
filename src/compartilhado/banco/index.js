// Conexão única com o SQLite e migrações versionadas.
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const PASTA_MIGRACOES = path.join(import.meta.dirname, 'migracoes');

/** @type {import('better-sqlite3').Database | undefined} */
let db;

/**
 * Lê as migrações `NNN_descricao.sql`, em ordem. O número é a versão do esquema e precisa ser
 * sequencial a partir de 001. Uma migração já publicada nunca é alterada: crie a próxima.
 */
export function listarMigracoes(pasta = PASTA_MIGRACOES) {
  const arquivos = fs
    .readdirSync(pasta)
    .filter((a) => a.endsWith('.sql'))
    .sort();
  return arquivos.map((arquivo, i) => {
    const versao = Number(arquivo.match(/^(\d+)_/)?.[1]);
    if (versao !== i + 1) throw new Error(`Migração fora de sequência: ${arquivo} (esperada a versão ${i + 1})`);
    return { versao, arquivo, sql: fs.readFileSync(path.join(pasta, arquivo), 'utf8') };
  });
}

/** Aplica as migrações pendentes, cada uma em sua transação. A versão fica em PRAGMA user_version. */
function migrar(banco) {
  const atual = Number(banco.pragma('user_version', { simple: true }));
  for (const m of listarMigracoes()) {
    if (m.versao <= atual) continue;
    banco.transaction(() => {
      banco.exec(m.sql);
      banco.pragma(`user_version = ${m.versao}`);
    })();
  }
}

/** Abre (ou cria) o banco e aplica as migrações pendentes. */
export function abrir(arquivo) {
  db = new Database(arquivo);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrar(db);
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
