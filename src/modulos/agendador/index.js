import { config } from '../../config.js';
import { executarCiclo } from '../disparo/index.js';
import { eventos as eventosWhatsapp } from '../whatsapp/index.js';

let timer = null;
let proximo = null;

async function rodar() {
  try {
    const r = await executarCiclo();
    if (r.executado && (r.enviados || r.falhas)) {
      console.log(`[agendador] ${r.enviados} enviado(s), ${r.falhas} falha(s), ${r.pulados} pulado(s)`);
    }
  } catch (e) {
    console.error('[agendador] erro no ciclo:', e);
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
