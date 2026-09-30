const pad = (n: number) => String(n).padStart(2, '0');

/** yyyy-MM-dd no fuso LOCAL (nunca usar toISOString para isso). */
export function diaKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function inicioDoDia(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function addDias(ts: number, n: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
}

/** 'yyyy-MM-dd' → timestamp da meia-noite local. */
export function parseDiaKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).getTime();
}

/** Segunda-feira 00:00 local da semana de `ts`. */
export function inicioDaSemana(ts: number): number {
  const d = new Date(inicioDoDia(ts));
  const dow = (d.getDay() + 6) % 7; // segunda = 0
  return addDias(d.getTime(), -dow);
}

export function fmtHora(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDuracao(minutos: number): string {
  const m = Math.max(0, Math.round(minutos));
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h${pad(r)}`;
}

export function fmtDataCurta(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

/** Valor para <input type="datetime-local"> (fuso local). */
export function toInputLocal(ts: number): string {
  const d = new Date(ts);
  return `${diaKey(ts)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromInputLocal(v: string): number {
  const [data, hora] = v.split('T');
  const [y, m, d] = (data ?? '').split('-').map(Number);
  const [hh, mm] = (hora ?? '00:00').split(':').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0).getTime();
}

export interface FatiaDia {
  dia: string;
  inicio: number;
  fim: number;
}

/** Divide um intervalo nas fronteiras de meia-noite (fuso local). */
export function fatiarPorDia(inicio: number, fim: number): FatiaDia[] {
  const out: FatiaDia[] = [];
  if (fim <= inicio) return out;
  let cursor = inicio;
  while (cursor < fim) {
    const proximaMeiaNoite = addDias(cursor, 1);
    const corte = Math.min(fim, proximaMeiaNoite);
    out.push({ dia: diaKey(cursor), inicio: cursor, fim: corte });
    cursor = corte;
  }
  return out;
}
