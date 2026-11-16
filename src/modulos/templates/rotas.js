import { Router } from 'express';
import * as configuracao from '#modulos/configuracao/index.js';
import { gerarArte, miniatura, salvarImagem, removerArquivo, LARGURA, ALTURA } from '#modulos/arte/index.js';
import { upload } from '#compartilhado/upload.js';
import { render } from '#compartilhado/views.js';
import { hojeISO } from '#compartilhado/datas.js';
import * as repo from './repositorio.js';
import { validar, membroExemplo } from './servico.js';

const rotas = Router();

function carregar(req, res, next) {
  const t = Number.isInteger(Number(req.params.id)) ? repo.obter(Number(req.params.id)) : null;
  if (!t) return render(res, 'erro', { titulo: 'Template não encontrado', mensagem: 'Esse template não existe.' }, 404);
  req.template = t;
  next();
}

rotas.get('/', (req, res) => {
  render(res, 'templates/lista', { lista: repo.listar(), ok: req.query.ok, erro: req.query.erro });
});

rotas.post('/:id', carregar, upload.single('fundo'), async (req, res) => {
  const t = req.template;
  const corpo = req.body ?? {};
  const dados = validar(corpo, t);
  try {
    if (req.file) {
      dados.fundo = await salvarImagem(req.file.buffer, 'fundos', `${t.tipo}-${Date.now()}`, {
        largura: LARGURA,
        altura: ALTURA,
      });
      removerArquivo(t.fundo);
    } else if (corpo.remover_fundo === 'on') {
      removerArquivo(t.fundo);
      dados.fundo = null;
    }
  } catch {
    return res.redirect(`/templates?erro=${t.id}#template-${t.id}`);
  }
  repo.atualizar(t.id, dados);
  res.redirect(`/templates?ok=${t.id}#template-${t.id}`);
});

rotas.get('/:id/previa.jpg', carregar, async (req, res, next) => {
  try {
    const hoje = hojeISO();
    let img = await gerarArte({
      membro: membroExemplo(req.template.tipo, hoje),
      template: req.template,
      dataAniversario: hoje,
      nomeMinisterio: configuracao.obter('nome_ministerio'),
    });
    const w = Number(req.query.w);
    if (w >= 120 && w <= 1080) img = await miniatura(img, w);
    res.type('jpeg').set('Cache-Control', 'no-store').send(img);
  } catch (e) {
    next(e);
  }
});

export default rotas;
