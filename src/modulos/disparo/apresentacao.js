// Como um registro de envio aparece para as pessoas (atividade recente e histórico).

/**
 * @typedef {object} Evento
 * @property {'sucesso' | 'falha' | 'teste'} tipo
 * @property {string} titulo
 * @property {string} descricao
 * @property {string} rotulo  etiqueta curta da origem do envio
 * @property {string} referencia  tentativa ou id da mensagem, para a linha técnica
 */

/**
 * @param {{ status: string, detalhe?: string | null, membro_nome?: string, template_nome?: string | null,
 *   tentativa: number }} envio
 * @returns {Evento}
 */
export function descreverEnvio(envio) {
  const detalhe = envio.detalhe ?? '';
  const quem = [envio.membro_nome, envio.template_nome].filter(Boolean).join(' · ');
  const tentativa = `Tentativa ${envio.tentativa} de 3`;
  const idMensagem = detalhe.match(/^Mensagem (\S+)/)?.[1] ?? '';

  if (envio.status === 'falhou') {
    const descricao = [envio.membro_nome, detalhe].filter(Boolean).join(' · ');
    return { tipo: 'falha', titulo: 'Envio falhou', descricao, rotulo: 'Aniversário', referencia: tentativa };
  }
  if (envio.status === 'teste' && detalhe.startsWith('Falhou:')) {
    return {
      tipo: 'falha',
      titulo: 'Teste falhou',
      descricao: [envio.membro_nome, detalhe.replace(/^Falhou:\s*/, '')].filter(Boolean).join(' · '),
      rotulo: 'Teste',
      referencia: tentativa,
    };
  }
  if (envio.status === 'teste') {
    return { tipo: 'teste', titulo: 'Teste enviado', descricao: quem, rotulo: 'Teste', referencia: idMensagem };
  }
  return {
    tipo: 'sucesso',
    titulo: 'Arte enviada ao grupo',
    descricao: quem,
    rotulo: 'Aniversário',
    referencia: idMensagem,
  };
}
