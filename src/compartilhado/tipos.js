// Tipos das linhas do banco, usados pela checagem de tipos (tsc --noEmit) via JSDoc.

/**
 * @typedef {object} Membro
 * @property {number} id
 * @property {string} nome
 * @property {string} data_nascimento AAAA-MM-DD
 * @property {'M' | 'F'} sexo
 * @property {0 | 1} ativo
 * @property {string | null} foto
 * @property {number | null} template_fixo_id
 * @property {string} [criado_em]
 * @property {string} [atualizado_em]
 */

/**
 * @typedef {object} Template
 * @property {number} id
 * @property {'masculino' | 'feminino' | 'infantil'} tipo
 * @property {string} nome
 * @property {string | null} fundo
 * @property {string} cor_destaque
 * @property {string} mensagem_arte
 * @property {string} legenda
 * @property {string} [atualizado_em]
 */

/**
 * @typedef {object} Envio
 * @property {number} id
 * @property {number} membro_id
 * @property {number | null} template_id
 * @property {string} data_aniversario
 * @property {'enviado' | 'falhou' | 'teste'} status
 * @property {number} tentativa
 * @property {string | null} detalhe
 * @property {string | null} arquivo_arte
 * @property {string} criado_em
 */

export {};
