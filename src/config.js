import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const producao = process.env.NODE_ENV === 'production';

export const config = {
  raiz,
  producao,
  porta: Number(process.env.PORTA || 3000),
  storage: path.resolve(process.env.STORAGE_DIR || path.join(raiz, 'storage')),
  adminUsuario: process.env.ADMIN_USUARIO || 'admin',
  adminSenha: process.env.ADMIN_SENHA || (producao ? '' : 'admin'),
  segredoSessao: process.env.SESSAO_SEGREDO || (producao ? '' : 'segredo-de-desenvolvimento'),
  intervaloCicloMin: Number(process.env.INTERVALO_CICLO_MIN || 15),
  maxTentativas: 3,
  whatsappDesativado: process.env.WHATSAPP_DESATIVADO === '1',
  monitorUrl: process.env.MONITOR_URL || '',
};

export function validarConfig() {
  const faltando = [];
  if (!config.adminSenha) faltando.push('ADMIN_SENHA');
  if (!config.segredoSessao) faltando.push('SESSAO_SEGREDO');
  if (faltando.length) {
    throw new Error(`Variáveis de ambiente obrigatórias ausentes: ${faltando.join(', ')}`);
  }
}
