import * as configuracao from '#modulos/configuracao/index.js';
import { hojeISO, partes, pad } from '#compartilhado/datas.js';
import * as repo from './repositorio.js';
import { escolherTemplate, montarLegenda } from './regra.js';

/**
 * Valores com que cada template é criado (migração 002), usados pelo "Restaurar padrão".
 * Um teste garante que continuam iguais aos da migração.
 */
export const TEMPLATES_PADRAO = Object.freeze({
  masculino: {
    nome: 'Masculino',
    cor_destaque: '#1565c0',
    mensagem_arte: 'Que Deus abençoe\nseu novo ano de vida!',
    legenda:
      '🎉 Hoje é aniversário do *{nome}*!\nParabéns pelos {idade} anos. Que Deus te abençoe grandemente!\n\n— {ministerio}',
  },
  feminino: {
    nome: 'Feminino',
    cor_destaque: '#c2185b',
    mensagem_arte: 'Que Deus abençoe\nseu novo ano de vida!',
    legenda:
      '🎉 Hoje é aniversário da *{nome}*!\nParabéns pelos {idade} anos. Que Deus te abençoe grandemente!\n\n— {ministerio}',
  },
  infantil: {
    nome: 'Infantil',
    cor_destaque: '#ef6c00',
    mensagem_arte: 'Hoje é dia de festa!\nDeus te ama muito!',
    legenda:
      '🎈 Hoje é dia de festa! *{nome}* está fazendo {idade} aninhos!\nQue Jesus encha sua vida de alegria!\n\n— {ministerio}',
  },
});

/** Cores oferecidas como atalho no editor, além da cor padrão do próprio template. */
export const CORES_SUGERIDAS = Object.freeze(['#3f5fb5', '#5b6cd9', '#2f7d88', '#7a5ac8', '#b4466f', '#d27333']);

/** Paleta do editor: cor padrão do template primeiro, sem repetir. */
export function coresDoEditor(tipo) {
  return [...new Set([TEMPLATES_PADRAO[tipo]?.cor_destaque, ...CORES_SUGERIDAS].filter(Boolean))];
}

/** Volta nome, cor e textos ao padrão. O fundo personalizado é mantido. */
export function restaurar(template) {
  const padrao = TEMPLATES_PADRAO[template.tipo];
  if (padrao) repo.atualizar(template.id, padrao);
}

/** Mensagem do template preenchida com o membro de exemplo, para a prévia do WhatsApp. */
export function legendaDeExemplo(template, hoje = hojeISO()) {
  return montarLegenda(template.legenda, {
    membro: membroExemplo(template.tipo, hoje),
    dataAniversario: hoje,
    nomeMinisterio: configuracao.obter('nome_ministerio'),
  });
}

/** Retorna uma função que resolve o template de um membro, lendo templates e configuração uma só vez. */
export function criarResolvedor() {
  const lista = repo.listar();
  const idadeLimiteInfantil = Number(configuracao.obter('idade_limite_infantil')) || 12;
  return (membro, dataAniversario) => escolherTemplate(membro, lista, { dataAniversario, idadeLimiteInfantil });
}

/**
 * Normaliza o formulário de um template. Campos inválidos mantêm o valor atual.
 * @param {Record<string, unknown>} corpo
 * @param {import('#compartilhado/tipos.js').Template} atual
 */
export function validar(corpo, atual) {
  const cor = String(corpo.cor_destaque ?? '');
  return {
    nome:
      String(corpo.nome ?? '')
        .trim()
        .slice(0, 60) || atual.nome,
    cor_destaque: /^#[0-9a-f]{6}$/i.test(cor) ? cor.toLowerCase() : atual.cor_destaque,
    mensagem_arte: String(corpo.mensagem_arte ?? '')
      .split(/\r?\n/)
      .slice(0, 2)
      .join('\n')
      .trim(),
    legenda: String(corpo.legenda ?? '')
      .replace(/\r\n/g, '\n')
      .trim(),
  };
}

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
