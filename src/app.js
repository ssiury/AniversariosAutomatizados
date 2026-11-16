import path from 'node:path';
import express from 'express';
import cookieSession from 'cookie-session';
import { pinoHttp } from 'pino-http';
import { config } from '#config';
import { logger } from '#compartilhado/logger.js';
import { render } from '#compartilhado/views.js';
import { getDb } from '#compartilhado/banco/index.js';
import * as whatsapp from '#modulos/whatsapp/index.js';
// As rotas de cada módulo só são importadas aqui, nunca pelos outros módulos.
import { rotasAuth, exigirLogin } from '#modulos/painel/auth.js';
import rotasPainel from '#modulos/painel/rotas.js';
import rotasMembros from '#modulos/membros/rotas.js';
import rotasTemplates from '#modulos/templates/rotas.js';
import rotasConfiguracao from '#modulos/configuracao/rotas.js';

export function criarApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'same-origin');
    next();
  });

  app.use(
    pinoHttp({
      logger: logger.child({ modulo: 'http' }),
      // Arquivos estáticos e o healthcheck só fariam ruído no log.
      autoLogging: { ignore: (req) => req.url.startsWith('/static') || req.url === '/saude' },
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      serializers: {
        req: (req) => ({ metodo: req.method, url: req.url }),
        res: (res) => ({ status: res.statusCode }),
      },
    }),
  );

  app.use('/static', express.static(path.join(config.raiz, 'public'), { maxAge: config.producao ? '1d' : 0 }));
  app.get('/static/htmx.min.js', (_req, res) => {
    res.sendFile(path.join(config.raiz, 'node_modules/htmx.org/dist/htmx.min.js'));
  });
  // Healthcheck do Docker: confirma que o banco responde. O WhatsApp fica de fora de propósito,
  // porque reiniciar o contêiner não resolve uma sessão desconectada (isso é papel do monitor).
  app.get('/saude', (_req, res) => {
    try {
      getDb().prepare('SELECT 1').get();
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.use(express.urlencoded({ extended: false, limit: '200kb' }));
  app.use(
    cookieSession({
      name: 'aniv_sessao',
      keys: [config.segredoSessao],
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: config.producao && !config.cookieInseguro,
    }),
  );

  app.use(rotasAuth);
  app.use(exigirLogin);
  // Estado do WhatsApp para o indicador do cabeçalho, em todas as páginas do painel.
  app.use((_req, res, next) => {
    res.locals.whatsapp = whatsapp.status();
    next();
  });

  // Só as pastas de imagens são servidas; a sessão do WhatsApp e o banco ficam de fora.
  for (const pasta of ['fotos', 'fundos', 'artes']) {
    app.use(`/storage/${pasta}`, express.static(path.join(config.storage, pasta), { fallthrough: false }));
  }

  app.use(rotasPainel);
  app.use('/membros', rotasMembros);
  app.use('/templates', rotasTemplates);
  app.use('/configuracoes', rotasConfiguracao);

  app.use((_req, res) =>
    render(res, 'erro', { titulo: 'Página não encontrada', mensagem: 'O endereço não existe.' }, 404),
  );
  app.use((err, req, res, _next) => {
    const status = err.status ?? err.statusCode;
    if (status === 404) {
      return render(res, 'erro', { titulo: 'Arquivo não encontrado', mensagem: 'O arquivo não existe.' }, 404);
    }
    // Erros do cliente (caminho proibido, upload grande demais, corpo inválido) não são falhas do servidor.
    if (Number.isInteger(status) && status >= 400 && status < 500) {
      return render(
        res,
        'erro',
        { titulo: 'Requisição inválida', mensagem: 'Não foi possível atender o pedido.' },
        status,
      );
    }
    req.log.error({ err }, 'Erro não tratado na requisição');
    render(res, 'erro', { titulo: 'Erro', mensagem: 'Algo deu errado. Tente novamente.' }, 500);
  });
  return app;
}
