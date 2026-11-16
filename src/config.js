import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');

/**
 * Monta a configuração a partir das variáveis de ambiente. Função pura, para poder ser testada.
 * @param {Record<string, string | undefined>} env
 */
export function carregarConfig(env) {
  const producao = env.NODE_ENV === 'production';
  return {
    raiz,
    producao,
    porta: Number(env.PORTA || 3000),
    storage: path.resolve(env.STORAGE_DIR || path.join(raiz, 'storage')),
    adminUsuario: env.ADMIN_USUARIO || 'admin',
    adminSenha: env.ADMIN_SENHA || (producao ? '' : 'admin'),
    segredoSessao: env.SESSAO_SEGREDO || (producao ? '' : 'segredo-de-desenvolvimento'),
    cookieInseguro: env.COOKIE_INSEGURO === '1',
    intervaloCicloMin: Number(env.INTERVALO_CICLO_MIN || 15),
    maxTentativas: 3,
    whatsappDesativado: env.WHATSAPP_DESATIVADO === '1',
    whatsappLog: env.WHATSAPP_LOG || 'warn',
    logNivel: env.LOG_NIVEL || 'info',
    monitorUrl: env.MONITOR_URL || '',
  };
}

export const config = carregarConfig(process.env);

const NIVEIS_LOG = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

/**
 * Confere a configuração e devolve os problemas encontrados.
 * @param {ReturnType<typeof carregarConfig>} cfg
 * @returns {{ erros: string[], avisos: string[] }}
 */
export function verificarConfig(cfg) {
  const erros = [];
  const avisos = [];
  if (!cfg.adminSenha) erros.push('ADMIN_SENHA é obrigatória em produção.');
  if (!cfg.segredoSessao) erros.push('SESSAO_SEGREDO é obrigatório em produção.');
  if (!Number.isInteger(cfg.porta) || cfg.porta < 1 || cfg.porta > 65535) {
    erros.push('PORTA deve ser um número entre 1 e 65535.');
  }
  if (!Number.isInteger(cfg.intervaloCicloMin) || cfg.intervaloCicloMin < 1 || cfg.intervaloCicloMin > 60) {
    erros.push('INTERVALO_CICLO_MIN deve ser um número inteiro entre 1 e 60.');
  }
  for (const [nome, valor] of [
    ['LOG_NIVEL', cfg.logNivel],
    ['WHATSAPP_LOG', cfg.whatsappLog],
  ]) {
    if (!NIVEIS_LOG.includes(valor)) erros.push(`${nome} deve ser um destes: ${NIVEIS_LOG.join(', ')}.`);
  }
  if (cfg.monitorUrl && !URL.canParse(cfg.monitorUrl)) erros.push('MONITOR_URL não é uma URL válida.');

  if (cfg.producao) {
    if (cfg.segredoSessao && cfg.segredoSessao.length < 32) {
      avisos.push('SESSAO_SEGREDO tem menos de 32 caracteres. Gere um novo com o comando do .env.example.');
    }
    if (cfg.adminSenha && cfg.adminSenha.length < 12) avisos.push('ADMIN_SENHA tem menos de 12 caracteres.');
    if (!cfg.monitorUrl) avisos.push('MONITOR_URL não definida: falhas de envio não geram alerta.');
    if (cfg.cookieInseguro) avisos.push('COOKIE_INSEGURO=1: o cookie de sessão pode trafegar sem HTTPS.');
  }
  return { erros, avisos };
}

/** Interrompe a inicialização se houver erros de configuração. */
export function validarConfig(cfg = config) {
  const { erros, avisos } = verificarConfig(cfg);
  if (erros.length) throw new Error(`Configuração inválida:\n- ${erros.join('\n- ')}`);
  return avisos;
}
