import path from 'node:path';
import { Eta } from 'eta';
import { config } from '../config.js';
import * as datas from './datas.js';

export const eta = new Eta({ views: path.join(config.raiz, 'views'), cache: config.producao });

export const helpers = {
  formatarBR: datas.formatarBR,
  formatarDiaMes: datas.formatarDiaMes,
  formatarDataHora: datas.formatarDataHora,
  nomeMes: datas.nomeMes,
  sexo: (s) => (s === 'F' ? 'Feminino' : 'Masculino'),
};

export function render(res, view, dados = {}, status = 200) {
  res
    .status(status)
    .type('html')
    .send(eta.render(view, { ...res.locals, h: helpers, ...dados }));
}

export function ehHtmx(req) {
  return req.get('HX-Request') === 'true';
}
