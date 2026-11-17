const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Valida o formulário de configurações e devolve { valores, erros }.
 * O grupo do WhatsApp é tratado à parte pelas rotas, porque o nome vem da lista de grupos.
 * @param {Record<string, unknown>} corpo
 */
export function validar(corpo = {}) {
  const erros = {};
  const horario = String(corpo.horario_envio ?? '');
  const idade = Number(corpo.idade_limite_infantil);
  const nome = String(corpo.nome_ministerio ?? '').trim();

  if (!HORARIO.test(horario)) erros.horario_envio = 'Horário inválido.';
  if (!Number.isInteger(idade) || idade < 1 || idade > 18) erros.idade_limite_infantil = 'Use um número entre 1 e 18.';
  if (!nome) erros.nome_ministerio = 'Informe o nome do ministério.';
  else if (nome.length > 80) erros.nome_ministerio = 'Nome muito longo.';

  return {
    erros,
    valores: {
      envio_ativo: corpo.envio_ativo === 'on' ? '1' : '0',
      horario_envio: horario,
      idade_limite_infantil: String(idade),
      nome_ministerio: nome,
    },
  };
}

/**
 * Nome a guardar para o grupo escolhido: o da lista atual, o já salvo ou, sem nenhum dos dois, o próprio id.
 * @param {string} grupo
 * @param {{ id: string, nome: string }[]} grupos
 * @param {{ grupo_whatsapp: string, grupo_whatsapp_nome: string }} atual
 */
export function nomeDoGrupo(grupo, grupos, atual) {
  return (
    grupos.find((g) => g.id === grupo)?.nome ?? (grupo === atual.grupo_whatsapp ? atual.grupo_whatsapp_nome : grupo)
  );
}
