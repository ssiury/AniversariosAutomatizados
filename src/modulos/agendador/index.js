import { config } from '#config';
import { logger } from '#compartilhado/logger.js';
import { executarCiclo } from '#modulos/disparo/index.js';
import { eventos as eventosWhatsapp, status as statusWhatsapp } from '#modulos/whatsapp/index.js';
import { reportarCiclo } from '#modulos/monitor/index.js';

const log = logger.child({ modulo: 'agendador' });

let timer = null;
let proximo = null;

async function rodar() {
  try {
    const r = await executarCiclo();
    if (r.executado && (r.enviados || r.falhas)) {
      const { enviados, falhas, pulados } = r;
      log[falhas ? 'warn' : 'info']({ enviados, falhas, pulados }, 'Ciclo concluído');
    } else {
      log.debug({ motivo: r.motivo }, 'Ciclo sem envios');
    }
    await reportarCiclo(r, { whatsapp: statusWhatsapp() });
  } catch (e) {
    log.error({ err: e }, 'Erro no ciclo');
  }
}

/** A cada N minutos roda um ciclo. Também roda logo após o WhatsApp conectar (recupera envios após reinício). */
export function iniciar() {
  const intervalo = config.intervaloCicloMin * 60_000;
  const agendar = () => {
    proximo = new Date(Date.now() + intervalo);
    timer = setTimeout(async () => {
      await rodar();
      agendar();
    }, intervalo);
  };
  agendar();
  eventosWhatsapp.on('conectado', () => setTimeout(rodar, 5_000));
  setTimeout(rodar, 10_000);
}

export function parar() {
  clearTimeout(timer);
  timer = null;
}

export function proximoCiclo() {
  return proximo;
}
