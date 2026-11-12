import fs from 'node:fs';
import path from 'node:path';
import { config, validarConfig } from './config.js';
import { abrir, fechar } from './modulos/dados/index.js';
import * as whatsapp from './modulos/whatsapp/index.js';
import * as agendador from './modulos/agendador/index.js';
import { criarApp } from './app.js';

validarConfig();
for (const pasta of ['', 'fotos', 'fundos', 'artes', 'whatsapp']) {
  fs.mkdirSync(path.join(config.storage, pasta), { recursive: true });
}
abrir(path.join(config.storage, 'dados.sqlite'));

const servidor = criarApp().listen(config.porta, () => {
  console.log(`Painel em http://localhost:${config.porta} (TZ=${process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone})`);
});

servidor.on('error', (e) => {
  console.error(`Não foi possível abrir a porta ${config.porta}:`, e.message);
  process.exit(1);
});

whatsapp.iniciar().catch((e) => console.error('[whatsapp] falha ao iniciar:', e));
agendador.iniciar();

function encerrar() {
  agendador.parar();
  servidor.close(() => {
    fechar();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5_000).unref();
}
process.on('SIGTERM', encerrar);
process.on('SIGINT', encerrar);
