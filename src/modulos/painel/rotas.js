import { Router } from 'express';
import * as disparo from '#modulos/disparo/index.js';
import { render } from '#compartilhado/views.js';
import { montarDashboard } from './dashboard.js';

const rotas = Router();

rotas.get('/', (_req, res) => {
  render(res, 'painel/dashboard', montarDashboard());
});

rotas.get('/historico', (req, res) => {
  const status = String(req.query.status ?? '');
  const pagina = Math.max(1, Number.parseInt(String(req.query.pagina ?? ''), 10) || 1);
  render(res, 'painel/historico', { ...disparo.listarEnvios({ status, pagina }), status, pagina });
});

export default rotas;
