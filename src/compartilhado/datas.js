// Datas são tratadas como strings ISO 'AAAA-MM-DD' no fuso local do processo (TZ).

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const DIAS_SEMANA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

export const pad = (n) => String(n).padStart(2, '0');

/** Dia da semana por extenso (ex.: "segunda-feira"). */
export function diaSemana(iso) {
  const { a, m, d } = partes(iso);
  return DIAS_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

/** Dia da semana abreviado, sem o "-feira" (ex.: "seg", "sáb"). */
export function diaSemanaCurto(iso) {
  return diaSemana(iso).slice(0, 3);
}

/** Sábado ou domingo. */
export function ehFimDeSemana(iso) {
  const { a, m, d } = partes(iso);
  return [0, 6].includes(new Date(Date.UTC(a, m - 1, d)).getUTCDay());
}

export function hojeISO(agora = new Date()) {
  return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
}

export function horaMinuto(agora = new Date()) {
  return `${pad(agora.getHours())}:${pad(agora.getMinutes())}`;
}

export function partes(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return { a, m, d };
}

export function ehBissexto(ano) {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

export function somarDias(iso, dias) {
  const { a, m, d } = partes(iso);
  const dt = new Date(Date.UTC(a, m - 1, d + dias));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function diasEntre(deISO, ateISO) {
  const x = partes(deISO);
  const y = partes(ateISO);
  return Math.round((Date.UTC(y.a, y.m - 1, y.d) - Date.UTC(x.a, x.m - 1, x.d)) / 86400000);
}

/** Data em que o aniversário é comemorado no ano dado (29/02 vira 28/02 em ano não bissexto). */
export function aniversarioNoAno(nascimento, ano) {
  const { m } = partes(nascimento);
  let { d } = partes(nascimento);
  if (m === 2 && d === 29 && !ehBissexto(ano)) d = 28;
  return `${ano}-${pad(m)}-${pad(d)}`;
}

export function ehAniversario(nascimento, dataISO) {
  return aniversarioNoAno(nascimento, partes(dataISO).a) === dataISO;
}

/** Próxima data de aniversário a partir de hoje (inclusive). */
export function proximoAniversario(nascimento, hoje) {
  const { a } = partes(hoje);
  const desteAno = aniversarioNoAno(nascimento, a);
  return desteAno >= hoje ? desteAno : aniversarioNoAno(nascimento, a + 1);
}

/** Anos completos na data informada. */
export function idadeEm(nascimento, dataISO) {
  const n = partes(nascimento);
  const x = partes(dataISO);
  let idade = x.a - n.a;
  if (dataISO < aniversarioNoAno(nascimento, x.a)) idade -= 1;
  return idade;
}

export function dataValida(iso, hoje = hojeISO()) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const { a, m, d } = partes(iso);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && a >= 1900 && iso <= hoje;
}

export function formatarBR(iso) {
  if (!iso) return '';
  const { a, m, d } = partes(iso.slice(0, 10));
  return `${pad(d)}/${pad(m)}/${a}`;
}

export function formatarDiaMes(iso) {
  const { m, d } = partes(iso);
  return `${d} de ${MESES[m - 1]}`;
}

export function nomeMes(m) {
  return MESES[m - 1];
}

export function formatarDataHora(sqlDateTime) {
  if (!sqlDateTime) return '';
  const [data, hora = ''] = sqlDateTime.split(' ');
  return `${formatarBR(data)} ${hora.slice(0, 5)}`.trim();
}
