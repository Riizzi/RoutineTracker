import { addDias, diaKey, fatiarPorDia, inicioDoDia, inicioDaSemana } from './time.ts';
import type { CategoriaStat, Lugar, Registro } from './types.ts';

export interface DiaStats {
  dia: string;
  inicio: number;
  total: number;
  porCategoria: Partial<Record<CategoriaStat, number>>;
  porLugar: Record<string, number>;
}

/** Minutos por dia (dividindo estadias que cruzam a meia-noite). */
export function estatisticasPorDia(
  registros: Registro[],
  lugares: Lugar[],
  now: number,
  primeiroDia: number,
  ultimoDia: number,
): DiaStats[] {
  const mapa = new Map<string, DiaStats>();
  for (let d = inicioDoDia(primeiroDia); d <= ultimoDia; d = addDias(d, 1)) {
    mapa.set(diaKey(d), { dia: diaKey(d), inicio: d, total: 0, porCategoria: {}, porLugar: {} });
  }
  const catDe = new Map(lugares.map((l) => [l.id, l.categoria]));
  const limiteSuperior = addDias(inicioDoDia(ultimoDia), 1);

  for (const r of registros) {
    const fim = Math.min(r.fim ?? Math.max(now, r.inicio), now);
    const cat: CategoriaStat = r.lugarId ? (catDe.get(r.lugarId) ?? 'desconhecido') : 'desconhecido';
    for (const f of fatiarPorDia(r.inicio, Math.min(fim, limiteSuperior))) {
      const dia = mapa.get(f.dia);
      if (!dia) continue;
      const min = (f.fim - f.inicio) / 60_000;
      dia.total += min;
      dia.porCategoria[cat] = (dia.porCategoria[cat] ?? 0) + min;
      if (r.lugarId) dia.porLugar[r.lugarId] = (dia.porLugar[r.lugarId] ?? 0) + min;
    }
  }
  return [...mapa.values()];
}

export interface ResumoPeriodo {
  dias: DiaStats[];
  porCategoria: Partial<Record<CategoriaStat, number>>;
  porLugar: Record<string, number>;
  total: number;
}

export function resumirPeriodo(dias: DiaStats[]): ResumoPeriodo {
  const porCategoria: ResumoPeriodo['porCategoria'] = {};
  const porLugar: Record<string, number> = {};
  let total = 0;
  for (const d of dias) {
    total += d.total;
    for (const [c, m] of Object.entries(d.porCategoria)) {
      const k = c as CategoriaStat;
      porCategoria[k] = (porCategoria[k] ?? 0) + (m ?? 0);
    }
    for (const [id, m] of Object.entries(d.porLugar)) porLugar[id] = (porLugar[id] ?? 0) + m;
  }
  return { dias, porCategoria, porLugar, total };
}

/** Período de `n` dias terminando hoje (`offset` = quantos períodos para trás). */
export function periodo(
  registros: Registro[],
  lugares: Lugar[],
  now: number,
  n: number,
  offset = 0,
): ResumoPeriodo {
  const hoje = inicioDoDia(now);
  const fim = addDias(hoje, -n * offset);
  const inicio = addDias(fim, -(n - 1));
  return resumirPeriodo(estatisticasPorDia(registros, lugares, now, inicio, fim));
}

/** Média (em minutos) dos dias em que a categoria teve presença. */
export function mediaDiasAtivos(dias: DiaStats[], cat: CategoriaStat): number {
  const ativos = dias.filter((d) => (d.porCategoria[cat] ?? 0) >= 1);
  if (ativos.length === 0) return 0;
  return ativos.reduce((s, d) => s + (d.porCategoria[cat] ?? 0), 0) / ativos.length;
}

/** Nº de dias distintos, na semana corrente (seg–dom), com pelo menos uma visita à categoria. */
export function diasNaSemana(
  registros: Registro[],
  lugares: Lugar[],
  cat: CategoriaStat,
  now: number,
): number {
  const ini = inicioDaSemana(now);
  const dias = estatisticasPorDia(registros, lugares, now, ini, addDias(ini, 6));
  return dias.filter((d) => (d.porCategoria[cat] ?? 0) >= 10).length;
}
