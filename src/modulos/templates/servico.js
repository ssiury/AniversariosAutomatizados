import * as configuracao from '#modulos/configuracao/index.js';
import { hojeISO, partes, pad } from '#compartilhado/datas.js';
import * as repo from './repositorio.js';
import { escolherTemplate } from './regra.js';

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
