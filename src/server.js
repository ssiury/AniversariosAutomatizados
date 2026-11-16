import fs from 'node:fs';
import path from 'node:path';
import { config, validarConfig } from './config.js';
import { logger } from './lib/logger.js';
import { abrir, fechar } from './modulos/dados/index.js';
import * as whatsapp from './modulos/whatsapp/index.js';
import * as agendador from './modulos/agendador/index.js';
import { criarApp } from './app.js';

const log = logger.child({ modulo: 'servidor' });

try {
  validarConfig().forEach((aviso) => log.warn(aviso));
} catch (e) {
  log.fatal(e.message);
  process.exit(1);
}

for (const pasta of ['', 'fotos', 'fundos', 'artes', 'whatsapp']) {
  fs.mkdirSync(path.join(config.storage, pasta), { recursive: true });
}
abrir(path.join(config.storage, 'dados.sqlite'));

const servidor = criarApp().listen(config.porta, () => {
  const fuso = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
  log.info({ porta: config.porta, fuso }, `Painel em http://localhost:${config.porta}`);
});

servidor.on('error', (e) => {
  log.fatal({ err: e }, `Não foi possível abrir a porta ${config.porta}`);
  process.exit(1);
});

whatsapp.iniciar().catch((e) => log.error({ err: e }, 'Falha ao iniciar o WhatsApp'));
agendador.iniciar();

function encerrar(sinal) {
  log.info({ sinal }, 'Encerrando');
  agendador.parar();
  servidor.close(() => {
    fechar();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5_000).unref();
}
process.on('SIGTERM', encerrar);
process.on('SIGINT', encerrar);
process.on('unhandledRejection', (motivo) => log.error({ err: motivo }, 'Promise rejeitada sem tratamento'));
