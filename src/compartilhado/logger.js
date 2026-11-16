import pino from 'pino';
import { config } from '#config';

/**
 * Logger único da aplicação: JSON estruturado em uma linha por evento, pronto para `docker compose logs`.
 * Em desenvolvimento, `npm run dev` formata a saída com o pino-pretty.
 * Cada módulo usa um filho com o próprio nome: `logger.child({ modulo: 'disparo' })`.
 */
export const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : config.logNivel,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});
