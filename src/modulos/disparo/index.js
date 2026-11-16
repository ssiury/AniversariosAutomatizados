// API pública do módulo de disparo: o ciclo diário, o "Enviar agora" e o histórico de envios.
export {
  executarCiclo,
  enviarAgora,
  enviarParaMembro,
  infoUltimoCiclo,
  usarCanal,
  usarPausa,
  MOTIVO_OCUPADO,
} from './servico.js';
export {
  situacaoDoDia,
  ultimoDoDia,
  contagens as contagensEnvios,
  ultimos as ultimosEnvios,
  listar as listarEnvios,
} from './repositorio.js';
export { descreverEnvio } from './apresentacao.js';
