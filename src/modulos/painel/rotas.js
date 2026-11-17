import { Router } from 'express';
import * as disparo from '#modulos/disparo/index.js';
import { render } from '#compartilhado/views.js';
import { hojeISO, somarDias } from '#compartilhado/datas.js';
import { montarDashboard } from './dashboard.js';

const rotas = Router();
const FILTROS_HISTORICO = ['enviado', 'teste', 'falhas'];

rotas.get('/', (_req, res) => {
  render(res, 'painel/dashboard', montarDashboard());
});

/** Agrupa os envios (já em ordem decrescente) pelo dia em que foram registrados. */
export function agruparPorDia(linhas, hoje = hojeISO()) {
  const ontem = somarDias(hoje, -1);
  const grupos = [];
  for (const e of linhas) {
    const data = e.criado_em.slice(0, 10);
    let grupo = grupos.at(-1);
    if (!grupo || grupo.data !== data) {
      grupo = { data, relativo: data === hoje ? 'Hoje' : data === ontem ? 'Ontem' : '', envios: [] };
      grupos.push(grupo);
    }
    grupo.envios.push({ ...e, evento: disparo.descreverEnvio(e) });
  }
  return grupos;
}

rotas.get('/historico', (req, res) => {
  const status = FILTROS_HISTORICO.includes(String(req.query.status)) ? String(req.query.status) : '';
  const pagina = Math.max(1, Number.parseInt(String(req.query.pagina ?? ''), 10) || 1);
  const { linhas, total, paginas } = disparo.listarEnvios({ status, pagina });
  render(res, 'painel/historico', {
    grupos: agruparPorDia(linhas),
    contagens: disparo.contagensEnvios(),
    total,
    paginas,
    status,
    pagina,
  });
});

export default rotas;
