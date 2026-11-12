import path from 'node:path';
import express from 'express';
import cookieSession from 'cookie-session';
import { config } from './config.js';
import { render } from './lib/views.js';
import { rotasAuth, exigirLogin, rotasPainel } from './modulos/painel/index.js';
import { rotasMembros } from './modulos/membros/index.js';
import { rotasTemplates } from './modulos/templates/index.js';

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

  app.use('/static', express.static(path.join(config.raiz, 'public'), { maxAge: config.producao ? '1d' : 0 }));
  app.get('/static/htmx.min.js', (_req, res) => {
    res.sendFile(path.join(config.raiz, 'node_modules/htmx.org/dist/htmx.min.js'));
  });
  app.get('/saude', (_req, res) => res.json({ ok: true }));

  app.use(express.urlencoded({ extended: false, limit: '200kb' }));
  app.use(cookieSession({
    name: 'aniv_sessao',
    keys: [config.segredoSessao],
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: config.producao && process.env.COOKIE_INSEGURO !== '1',
  }));

  app.use(rotasAuth);
  app.use(exigirLogin);

  // Só as pastas de imagens são servidas; a sessão do WhatsApp e o banco ficam de fora.
  for (const pasta of ['fotos', 'fundos', 'artes']) {
    app.use(`/storage/${pasta}`, express.static(path.join(config.storage, pasta), { fallthrough: false }));
  }

  app.use(rotasPainel);
  app.use('/membros', rotasMembros);
  app.use('/templates', rotasTemplates);

  app.use((_req, res) => render(res, 'erro', { titulo: 'Página não encontrada', mensagem: 'O endereço não existe.' }, 404));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.status === 404 || err.statusCode === 404) {
      return render(res, 'erro', { titulo: 'Arquivo não encontrado', mensagem: 'O arquivo não existe.' }, 404);
    }
    console.error(err);
    render(res, 'erro', { titulo: 'Erro', mensagem: 'Algo deu errado. Tente novamente.' }, 500);
  });
  return app;
}
