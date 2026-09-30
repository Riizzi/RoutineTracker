import { distanciaM } from './geo.ts';
import { MIN_DESCONHECIDO_MIN } from './engine.ts';
import type { Coordenada, Lugar, Registro, Sugestao } from './types.ts';

const RAIO_CLUSTER = 200;

export interface CriteriosDescoberta {
  /** minutos acumulados mínimos para sugerir */
  descobertaMinutos: number;
}

/**
 * Agrupa estadias em locais não cadastrados e devolve os grupos que merecem uma
 * pergunta "quer cadastrar este lugar?": tempo acumulado suficiente E
 * (2+ visitas OU uma estadia longa, 2h+).
 */
export function calcularSugestoes(
  registros: Registro[],
  lugares: Lugar[],
  ignorados: Coordenada[],
  criterios: CriteriosDescoberta,
  now: number,
): Sugestao[] {
  const ativos = lugares.filter((l) => l.ativo);
  // Estadia aberta: conta até o último sinal (conservador se o celular ficou sem dados).
  const fimEfetivo = (r: Registro) => r.fim ?? r.ultimoSinal;
  const candidatos = registros
    .filter((r) => r.lugarId === null && (fimEfetivo(r) - r.inicio) / 60_000 >= MIN_DESCONHECIDO_MIN)
    .sort((a, b) => a.inicio - b.inicio);

  interface Grupo {
    id: string;
    lat: number;
    lng: number;
    peso: number;
    visitas: number;
    minutos: number;
    primeira: number;
    ultima: number;
    atual: boolean;
  }
  const grupos: Grupo[] = [];

  for (const r of candidatos) {
    if (ativos.some((l) => distanciaM(r.latitude, r.longitude, l.latitude, l.longitude) <= l.raio)) continue;
    const fim = fimEfetivo(r);
    const minutos = (fim - r.inicio) / 60_000;
    const g = grupos.find((x) => distanciaM(x.lat, x.lng, r.latitude, r.longitude) <= RAIO_CLUSTER);
    if (g) {
      const novoPeso = g.peso + minutos;
      g.lat = (g.lat * g.peso + r.latitude * minutos) / novoPeso;
      g.lng = (g.lng * g.peso + r.longitude * minutos) / novoPeso;
      g.peso = novoPeso;
      g.visitas += 1;
      g.minutos += minutos;
      g.ultima = Math.max(g.ultima, fim);
      g.atual = g.atual || r.fim === null;
    } else {
      grupos.push({
        id: r.id,
        lat: r.latitude,
        lng: r.longitude,
        peso: minutos,
        visitas: 1,
        minutos,
        primeira: r.inicio,
        ultima: fim,
        atual: r.fim === null,
      });
    }
  }

  return grupos
    .filter((g) => g.minutos >= criterios.descobertaMinutos && (g.visitas >= 2 || g.minutos >= 120))
    .filter((g) => !ignorados.some((i) => distanciaM(i.latitude, i.longitude, g.lat, g.lng) <= RAIO_CLUSTER))
    .sort((a, b) => b.minutos - a.minutos)
    .map((g) => ({
      id: g.id,
      latitude: g.lat,
      longitude: g.lng,
      visitas: g.visitas,
      minutos: Math.round(g.minutos),
      primeira: g.primeira,
      ultima: g.ultima,
      atual: g.atual,
    }));
}
