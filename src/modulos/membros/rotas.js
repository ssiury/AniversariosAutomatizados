import { Router } from 'express';
import * as templates from '#modulos/templates/index.js';
import * as configuracao from '#modulos/configuracao/index.js';
import * as disparo from '#modulos/disparo/index.js';
import { gerarArte, miniatura, salvarImagem, removerArquivo } from '#modulos/arte/index.js';
import { upload } from '#compartilhado/upload.js';
import { render, ehHtmx } from '#compartilhado/views.js';
import { hojeISO } from '#compartilhado/datas.js';
import * as repo from './repositorio.js';
import { validar, listarDetalhado, detalhar } from './servico.js';

const rotas = Router();

function carregar(req, res, next) {
  const membro = Number.isInteger(Number(req.params.id)) ? repo.obter(Number(req.params.id)) : null;
  if (!membro)
    return render(res, 'erro', { titulo: 'Membro não encontrado', mensagem: 'Esse membro não existe.' }, 404);
  req.membro = membro;
  next();
}

rotas.get('/', (req, res) => {
  const filtros = {
    busca: String(req.query.busca ?? ''),
    sexo: String(req.query.sexo ?? ''),
    situacao: String(req.query.situacao ?? ''),
    mes: String(req.query.mes ?? ''),
  };
  const lista = listarDetalhado(filtros);
  render(res, ehHtmx(req) ? 'membros/linhas' : 'membros/lista', { lista, filtros });
});

rotas.get('/novo', (_req, res) => {
  render(res, 'membros/formulario', {
    membro: { ativo: 1 },
    erros: {},
    templates: templates.listar(),
    novo: true,
  });
});

async function salvarFoto(req, id, fotoAtual) {
  if (req.body.remover_foto === 'on' && !req.file) {
    removerArquivo(fotoAtual);
    return null;
  }
  if (!req.file) return fotoAtual ?? null;
  const nova = await salvarImagem(req.file.buffer, 'fotos', `membro${id}-${Date.now()}`, { largura: 800, altura: 800 });
  if (fotoAtual) removerArquivo(fotoAtual);
  return nova;
}

rotas.post('/', upload.single('foto'), async (req, res) => {
  const { dados, erros } = validar(req.body);
  if (Object.keys(erros).length) {
    return render(res, 'membros/formulario', { membro: dados, erros, templates: templates.listar(), novo: true }, 422);
  }
  const id = repo.criar(dados);
  try {
    repo.atualizar(id, { foto: await salvarFoto(req, id, null) });
  } catch {
    return res.redirect(`/membros/${id}?aviso=foto`);
  }
  res.redirect(`/membros/${id}?ok=criado`);
});

rotas.get('/:id', carregar, (req, res) => {
  render(res, 'membros/formulario', {
    membro: detalhar(req.membro),
    erros: {},
    templates: templates.listar(),
    novo: false,
    ok: req.query.ok,
    aviso: req.query.aviso,
  });
});

rotas.post('/:id', carregar, upload.single('foto'), async (req, res) => {
  const { dados, erros } = validar(req.body);
  if (Object.keys(erros).length) {
    return render(
      res,
      'membros/formulario',
      {
        membro: { ...req.membro, ...dados },
        erros,
        templates: templates.listar(),
        novo: false,
      },
      422,
    );
  }
  try {
    dados.foto = await salvarFoto(req, req.membro.id, req.membro.foto);
  } catch {
    erros.foto = 'Não foi possível ler a imagem enviada.';
    return render(
      res,
      'membros/formulario',
      {
        membro: { ...req.membro, ...dados },
        erros,
        templates: templates.listar(),
        novo: false,
      },
      422,
    );
  }
  repo.atualizar(req.membro.id, dados);
  res.redirect(`/membros/${req.membro.id}?ok=salvo`);
});

rotas.post('/:id/excluir', carregar, (req, res) => {
  removerArquivo(req.membro.foto);
  repo.remover(req.membro.id);
  res.redirect('/membros');
});

rotas.get('/:id/previa.jpg', carregar, async (req, res, next) => {
  try {
    const m = detalhar(req.membro, hojeISO());
    let img = await gerarArte({
      membro: req.membro,
      template: m.template,
      dataAniversario: m.proximo_aniversario,
      nomeMinisterio: configuracao.obter('nome_ministerio'),
    });
    const w = Number(req.query.w);
    if (w >= 120 && w <= 1080) img = await miniatura(img, w);
    res.type('jpeg').set('Cache-Control', 'no-store').send(img);
  } catch (e) {
    next(e);
  }
});

rotas.post('/:id/enviar', carregar, async (req, res) => {
  const r = await disparo.enviarAgora(req.membro.id);
  render(res, 'parciais/resultado', {
    ok: r.ok,
    mensagem: r.ok ? `Arte enviada para o grupo (template ${r.template?.nome}).` : `Falha no envio: ${r.erro}`,
  });
});

export default rotas;
