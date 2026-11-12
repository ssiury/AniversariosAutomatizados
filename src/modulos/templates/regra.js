import { idadeEm, formatarDiaMes } from '../../lib/datas.js';

/**
 * Escolhe o template do membro para o aniversário em `dataAniversario`.
 * Ordem (vale a primeira verdadeira): template fixo → infantil (idade < limite) → feminino → masculino.
 */
export function escolherTemplate(membro, templates, { dataAniversario, idadeLimiteInfantil = 12 }) {
  if (membro.template_fixo_id) {
    const fixo = templates.find((t) => t.id === membro.template_fixo_id);
    if (fixo) return fixo;
  }
  const porTipo = (tipo) => templates.find((t) => t.tipo === tipo);
  if (idadeEm(membro.data_nascimento, dataAniversario) < idadeLimiteInfantil) return porTipo('infantil');
  return membro.sexo === 'F' ? porTipo('feminino') : porTipo('masculino');
}

/** Substitui {nome}, {idade}, {data} e {ministerio} na legenda. */
export function montarLegenda(legenda, { membro, dataAniversario, nomeMinisterio }) {
  const valores = {
    nome: membro.nome,
    idade: String(idadeEm(membro.data_nascimento, dataAniversario)),
    data: formatarDiaMes(dataAniversario),
    ministerio: nomeMinisterio,
  };
  return (legenda || '').replace(/\{(nome|idade|data|ministerio)\}/g, (_, k) => valores[k]);
}
