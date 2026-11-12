import { Router } from 'express';
import { membros as repo, templates as repoTemplates, configuracao } from '../dados/index.js';
import { gerarArte, miniatura, salvarImagem, removerArquivo } from '../arte/index.js';
import { enviarAgora } from '../disparo/index.js';
import { upload } from '../../lib/upload.js';
import { render, ehHtmx } from '../../lib/views.js';
import { hojeISO } from '../../lib/datas.js';
import { validar, listarDetalhado, detalhar } from './servico.js';

const rotas = Router();

function carregar(req, res, next) {
  const membro = Number.isInteger(Number(req.params.id)) ? repo.obter(Number(req.params.id)) : null;
  if (!membro) return render(res, 'erro', { titulo: 'Membro não encontrado', mensagem: 'Esse membro não existe.' }, 404);
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
  render(res, ehHtmx(req) ? 'membros-linhas' : 'membros-lista', { lista, filtros });
});

rotas.get('/novo', (_req, res) => {
  render(res, 'membros-form', {
    membro: { ativo: 1 }, erros: {}, templates: repoTemplates.listar(), novo: true,
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
    return render(res, 'membros-form', { membro: dados, erros, templates: repoTemplates.listar(), novo: true }, 422);
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
  render(res, 'membros-form', {
    membro: detalhar(req.membro), erros: {}, templates: repoTemplates.listar(), novo: false,
    ok: req.query.ok, aviso: req.query.aviso,
  });
});

rotas.post('/:id', carregar, upload.single('foto'), async (req, res) => {
  const { dados, erros } = validar(req.body);
  if (Object.keys(erros).length) {
    return render(res, 'membros-form', {
      membro: { ...req.membro, ...dados }, erros, templates: repoTemplates.listar(), novo: false,
    }, 422);
  }
  try {
    dados.foto = await salvarFoto(req, req.membro.id, req.membro.foto);
  } catch {
    erros.foto = 'Não foi possível ler a imagem enviada.';
    return render(res, 'membros-form', {
      membro: { ...req.membro, ...dados }, erros, templates: repoTemplates.listar(), novo: false,
    }, 422);
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
      membro: req.membro, template: m.template, dataAniversario: m.proximo_aniversario,
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
  const r = await enviarAgora(req.membro.id);
  render(res, 'fragmento-resultado', {
    ok: r.ok,
    mensagem: r.ok ? `Arte enviada para o grupo (template ${r.template?.nome}).` : `Falha no envio: ${r.erro}`,
  });
});

export default rotas;
