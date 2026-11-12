import { membros as repo, templates as repoTemplates } from '../dados/index.js';
import { criarResolvedor } from '../templates/index.js';
import { hojeISO, idadeEm, proximoAniversario, dataValida, diasEntre } from '../../lib/datas.js';

/** Valida o formulário e devolve { dados, erros }. */
export function validar(corpo = {}) {
  const erros = {};
  const nome = String(corpo.nome ?? '').trim().replace(/\s+/g, ' ');
  const dataNascimento = String(corpo.data_nascimento ?? '').trim();
  const sexo = String(corpo.sexo ?? '');
  const templateFixo = String(corpo.template_fixo_id ?? '');

  if (!nome) erros.nome = 'Informe o nome.';
  else if (nome.length > 120) erros.nome = 'Nome muito longo.';
  if (!dataValida(dataNascimento)) erros.data_nascimento = 'Informe a data completa (dia, mês e ano), que não pode estar no futuro.';
  if (sexo !== 'M' && sexo !== 'F') erros.sexo = 'Escolha o sexo.';

  let templateFixoId = null;
  if (templateFixo) {
    templateFixoId = Number(templateFixo);
    if (!repoTemplates.obter(templateFixoId)) erros.template_fixo_id = 'Template inválido.';
  }

  return {
    erros,
    dados: {
      nome,
      data_nascimento: dataNascimento,
      sexo,
      ativo: corpo.ativo === 'on' || corpo.ativo === '1' ? 1 : 0,
      template_fixo_id: templateFixoId,
    },
  };
}

/** Lista com campos calculados: idade, próximo aniversário, dias até ele e template que vai receber. */
export function listarDetalhado(filtros = {}, hoje = hojeISO()) {
  const resolver = criarResolvedor();
  return repo.listar(filtros).map((m) => detalhar(m, hoje, resolver));
}

export function detalhar(m, hoje = hojeISO(), resolver = criarResolvedor()) {
  const proximo = proximoAniversario(m.data_nascimento, hoje);
  return {
    ...m,
    idade: idadeEm(m.data_nascimento, hoje),
    proximo_aniversario: proximo,
    dias_ate: diasEntre(hoje, proximo),
    template: resolver(m, proximo),
  };
}
