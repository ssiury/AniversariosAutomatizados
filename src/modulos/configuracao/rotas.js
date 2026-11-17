import { Router } from 'express';
import * as whatsapp from '#modulos/whatsapp/index.js';
import * as disparo from '#modulos/disparo/index.js';
import { render } from '#compartilhado/views.js';
import { logger } from '#compartilhado/logger.js';
import * as repo from './repositorio.js';
import { validar, nomeDoGrupo } from './servico.js';

const rotas = Router();
const log = logger.child({ modulo: 'configuracao' });

async function dadosDaPagina() {
  const wa = whatsapp.status();
  let grupos = [];
  let erroGrupos = null;
  if (wa.conectado) {
    try {
      grupos = await whatsapp.listarGrupos();
    } catch (e) {
      erroGrupos = e.message;
    }
  }
  return { cfg: repo.todas(), wa, grupos, erroGrupos };
}

rotas.get('/', async (req, res) => {
  render(res, 'configuracao/pagina', { ...(await dadosDaPagina()), ok: req.query.ok, erros: {} });
});

rotas.post('/', async (req, res) => {
  const corpo = req.body ?? {};
  const { valores, erros } = validar(corpo);
  const dados = await dadosDaPagina();
  if ('grupo_whatsapp' in corpo) {
    const grupo = String(corpo.grupo_whatsapp);
    Object.assign(valores, { grupo_whatsapp: grupo, grupo_whatsapp_nome: nomeDoGrupo(grupo, dados.grupos, dados.cfg) });
  }
  if (Object.keys(erros).length) {
    return render(res, 'configuracao/pagina', { ...dados, cfg: { ...dados.cfg, ...valores }, erros }, 422);
  }
  repo.definir(valores);
  res.redirect('/configuracoes?ok=1');
});

rotas.get('/whatsapp', (_req, res) => {
  const wa = whatsapp.status();
  // O fragmento só é consultado enquanto desconectado: ao conectar, recarrega a página para listar os grupos.
  if (wa.conectado) res.set('HX-Refresh', 'true');
  render(res, 'configuracao/whatsapp', { wa });
});

rotas.post('/whatsapp/desconectar', async (_req, res) => {
  try {
    await whatsapp.desconectar();
  } catch (e) {
    log.error({ err: e }, 'Erro ao desconectar o WhatsApp');
  }
  res.redirect('/configuracoes');
});

rotas.post('/ciclo', async (_req, res) => {
  const r = await disparo.executarCiclo({ ignorarHorario: true });
  render(res, 'parciais/resultado', {
    ok: r.executado,
    mensagem: r.executado
      ? `Ciclo concluído: ${r.enviados} enviado(s), ${r.falhas} falha(s), ${r.pulados} já tratado(s).`
      : `Ciclo não executado: ${r.motivo}.`,
  });
});

export default rotas;
