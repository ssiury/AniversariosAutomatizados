import { Router } from 'express';
import { envios, configuracao } from '../dados/index.js';
import * as whatsapp from '../whatsapp/index.js';
import { executarCiclo } from '../disparo/index.js';
import { render } from '../../lib/views.js';
import { logger } from '../../lib/logger.js';
import { montarDashboard } from './dashboard.js';

const rotas = Router();

rotas.get('/', (_req, res) => {
  render(res, 'dashboard', montarDashboard());
});

rotas.get('/historico', (req, res) => {
  const status = String(req.query.status ?? '');
  const pagina = Math.max(1, Number.parseInt(String(req.query.pagina ?? ''), 10) || 1);
  render(res, 'historico', { ...envios.listar({ status, pagina }), status, pagina });
});

async function dadosConfiguracoes() {
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
  return { cfg: configuracao.todas(), wa, grupos, erroGrupos };
}

rotas.get('/configuracoes', async (req, res) => {
  render(res, 'configuracoes', { ...(await dadosConfiguracoes()), ok: req.query.ok, erros: {} });
});

rotas.post('/configuracoes', async (req, res) => {
  const b = req.body ?? {};
  const erros = {};
  const horario = String(b.horario_envio ?? '');
  const idade = Number(b.idade_limite_infantil);
  const nome = String(b.nome_ministerio ?? '').trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) erros.horario_envio = 'Horário inválido.';
  if (!Number.isInteger(idade) || idade < 1 || idade > 18) erros.idade_limite_infantil = 'Use um número entre 1 e 18.';
  if (!nome) erros.nome_ministerio = 'Informe o nome do ministério.';

  const valores = {
    envio_ativo: b.envio_ativo === 'on' ? '1' : '0',
    horario_envio: horario,
    idade_limite_infantil: String(idade),
    nome_ministerio: nome,
  };
  if ('grupo_whatsapp' in b) {
    const dados = await dadosConfiguracoes();
    const grupo = String(b.grupo_whatsapp);
    valores.grupo_whatsapp = grupo;
    valores.grupo_whatsapp_nome =
      dados.grupos.find((g) => g.id === grupo)?.nome ??
      (grupo === dados.cfg.grupo_whatsapp ? dados.cfg.grupo_whatsapp_nome : grupo);
  }
  if (Object.keys(erros).length) {
    const dados = await dadosConfiguracoes();
    return render(res, 'configuracoes', { ...dados, cfg: { ...dados.cfg, ...valores }, erros }, 422);
  }
  configuracao.definir(valores);
  res.redirect('/configuracoes?ok=1');
});

rotas.get('/configuracoes/whatsapp', (_req, res) => {
  const wa = whatsapp.status();
  // O fragmento só é consultado enquanto desconectado: ao conectar, recarrega a página para listar os grupos.
  if (wa.conectado) res.set('HX-Refresh', 'true');
  render(res, 'fragmento-whatsapp', { wa });
});

rotas.post('/configuracoes/whatsapp/desconectar', async (_req, res) => {
  try {
    await whatsapp.desconectar();
  } catch (e) {
    logger.error({ err: e, modulo: 'painel' }, 'Erro ao desconectar o WhatsApp');
  }
  res.redirect('/configuracoes');
});

rotas.post('/configuracoes/ciclo', async (_req, res) => {
  const r = await executarCiclo({ ignorarHorario: true });
  render(res, 'fragmento-resultado', {
    ok: r.executado,
    mensagem: r.executado
      ? `Ciclo concluído: ${r.enviados} enviado(s), ${r.falhas} falha(s), ${r.pulados} já tratado(s).`
      : `Ciclo não executado: ${r.motivo}.`,
  });
});

export default rotas;
