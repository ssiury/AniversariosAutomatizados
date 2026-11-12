import { templates as repo, configuracao } from '../dados/index.js';
import { escolherTemplate, montarLegenda } from './regra.js';

export { escolherTemplate, montarLegenda };

/** Retorna uma função que resolve o template de um membro, lendo templates e configuração uma só vez. */
export function criarResolvedor() {
  const lista = repo.listar();
  const idadeLimiteInfantil = Number(configuracao.obter('idade_limite_infantil')) || 12;
  return (membro, dataAniversario) => escolherTemplate(membro, lista, { dataAniversario, idadeLimiteInfantil });
}

export { default as rotasTemplates } from './rotas.js';
