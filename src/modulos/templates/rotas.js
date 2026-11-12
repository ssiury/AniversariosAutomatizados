import { Router } from 'express';
import { templates as repo, configuracao } from '../dados/index.js';
import { gerarArte, miniatura, salvarImagem, removerArquivo, LARGURA, ALTURA } from '../arte/index.js';
import { upload } from '../../lib/upload.js';
import { render } from '../../lib/views.js';
import { hojeISO, partes, pad } from '../../lib/datas.js';

const rotas = Router();

const EXEMPLOS = {
  masculino: { nome: 'João Exemplo da Silva', sexo: 'M', idade: 30 },
  feminino: { nome: 'Maria Exemplo da Silva', sexo: 'F', idade: 28 },
  infantil: { nome: 'Pedrinho Exemplo', sexo: 'M', idade: 7 },
};

/** Membro fictício que faz aniversário hoje, usado na prévia do template. */
export function membroExemplo(tipo, hoje = hojeISO()) {
  const e = EXEMPLOS[tipo] ?? EXEMPLOS.masculino;
  const { a, m, d } = partes(hoje);
  const dia = m === 2 && d === 29 ? 28 : d;
  return { id: 0, nome: e.nome, sexo: e.sexo, foto: null, data_nascimento: `${a - e.idade}-${pad(m)}-${pad(dia)}` };
}

function carregar(req, res, next) {
  const t = Number.isInteger(Number(req.params.id)) ? repo.obter(Number(req.params.id)) : null;
  if (!t) return render(res, 'erro', { titulo: 'Template não encontrado', mensagem: 'Esse template não existe.' }, 404);
  req.template = t;
  next();
}

rotas.get('/', (req, res) => {
  render(res, 'templates', { lista: repo.listar(), ok: req.query.ok, erro: req.query.erro });
});

rotas.post('/:id', carregar, upload.single('fundo'), async (req, res) => {
  const t = req.template;
  const corpo = req.body ?? {};
  const cor = String(corpo.cor_destaque ?? '');
  const dados = {
    nome: String(corpo.nome ?? '').trim() || t.nome,
    cor_destaque: /^#[0-9a-f]{6}$/i.test(cor) ? cor.toLowerCase() : t.cor_destaque,
    mensagem_arte: String(corpo.mensagem_arte ?? '').split(/\r?\n/).slice(0, 2).join('\n').trim(),
    legenda: String(corpo.legenda ?? '').replace(/\r\n/g, '\n').trim(),
  };
  try {
    if (req.file) {
      dados.fundo = await salvarImagem(req.file.buffer, 'fundos', `${t.tipo}-${Date.now()}`, { largura: LARGURA, altura: ALTURA });
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
      membro: membroExemplo(req.template.tipo, hoje), template: req.template, dataAniversario: hoje,
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
