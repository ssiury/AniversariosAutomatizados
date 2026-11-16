import crypto from 'node:crypto';
import { Router } from 'express';
import { config } from '#config';
import { render } from '#compartilhado/views.js';

const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();
const igual = (a, b) => crypto.timingSafeEqual(hash(a), hash(b));

// Limite simples de tentativas por IP (5 erros em 15 min).
const tentativas = new Map();
function bloqueado(ip) {
  const t = tentativas.get(ip);
  if (!t || Date.now() - t.inicio > 15 * 60_000) return false;
  return t.erros >= 5;
}
function registrarErro(ip) {
  const t = tentativas.get(ip);
  if (!t || Date.now() - t.inicio > 15 * 60_000) tentativas.set(ip, { inicio: Date.now(), erros: 1 });
  else t.erros += 1;
}

export const rotasAuth = Router();

rotasAuth.get('/login', (req, res) => {
  if (req.session?.usuario) return res.redirect('/');
  render(res, 'painel/login', { erro: null });
});

rotasAuth.post('/login', (req, res) => {
  const ip = req.ip;
  if (bloqueado(ip)) {
    return render(res, 'painel/login', { erro: 'Muitas tentativas. Aguarde alguns minutos.' }, 429);
  }
  const { usuario = '', senha = '' } = req.body ?? {};
  if (igual(usuario, config.adminUsuario) && igual(senha, config.adminSenha)) {
    tentativas.delete(ip);
    req.session.usuario = config.adminUsuario;
    return res.redirect('/');
  }
  registrarErro(ip);
  render(res, 'painel/login', { erro: 'Usuário ou senha inválidos.' }, 401);
});

rotasAuth.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/login');
});

export function exigirLogin(req, res, next) {
  if (req.session?.usuario) {
    res.locals.usuario = req.session.usuario;
    res.locals.caminho = req.path;
    return next();
  }
  if (req.get('HX-Request') === 'true') return res.set('HX-Redirect', '/login').status(401).end();
  res.redirect('/login');
}
