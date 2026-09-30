import { distanciaM } from './geo.ts';
import type { EngineState, Lugar, NativeEvent, NativeSample, Registro } from './types.ts';

/** Silêncio tolerado ao inferir uma saída a partir de amostras (ms). */
const TETO_SILENCIO_MS = 20 * 60_000;
/** Raio para agrupar amostras numa mesma estadia desconhecida. */
const RAIO_DESCONHECIDO = 200;
/** Se passar disso sem amostras, a estadia desconhecida é encerrada. */
const LACUNA_MAXIMA_MS = 90 * 60_000;
/** Estadias desconhecidas mais curtas que isso são só trânsito. */
export const MIN_DESCONHECIDO_MIN = 20;
/** Visitas ao mesmo lugar separadas por menos que isso são fundidas (oscilação na borda da cerca). */
const FUSAO_MS = 10 * 60_000;
const ACC_MAX_MEMBRO = 200;
const ACC_MAX_DESCONHECIDO = 300;

export const engineInicial = (): EngineState => ({
  dentro: {},
  abertoId: null,
  epoch: null,
  cursorEvento: 0,
  cursorAmostra: 0,
});

export interface EntradaMotor {
  lugares: Lugar[];
  registros: Registro[];
  engine: EngineState;
  eventos: NativeEvent[];
  amostras: NativeSample[];
  minutosMinimos: number;
  novoId: () => string;
}

export interface SaidaMotor {
  registros: Registro[];
  engine: EngineState;
}

interface Item {
  t: number;
  ordem: number;
  ev?: NativeEvent;
  sa?: NativeSample;
}

/**
 * Processa eventos de geofence e amostras (em ordem cronológica) e devolve o novo
 * estado. Função pura: não lê relógio, não faz I/O. Idempotente em relação aos
 * cursores (itens com seq <= cursor são ignorados).
 */
export function processar(entrada: EntradaMotor): SaidaMotor {
  const ativos = new Map(entrada.lugares.filter((l) => l.ativo).map((l) => [l.id, l]));
  const registros = entrada.registros.slice();
  const dentro: EngineState['dentro'] = {};
  for (const [id, st] of Object.entries(entrada.engine.dentro)) {
    if (ativos.has(id)) dentro[id] = { ...st };
  }

  // Extrai o registro aberto para uma variável local (volta ao array no fim).
  let aberto: Registro | null = null;
  if (entrada.engine.abertoId) {
    const i = registros.findIndex((r) => r.id === entrada.engine.abertoId);
    if (i >= 0) {
      aberto = registros[i]!;
      registros.splice(i, 1);
    }
  }
  // Lugar do registro aberto foi apagado/desativado: encerra no último sinal.
  const fecharAberto = (fim: number) => {
    if (!aberto) return;
    const r: Registro = { ...aberto, fim: Math.max(fim, aberto.inicio) };
    aberto = null;
    const dur = r.fim! - r.inicio;
    const minimoMs = r.lugarId ? entrada.minutosMinimos * 60_000 : MIN_DESCONHECIDO_MIN * 60_000;
    if (dur < minimoMs && !r.editado) return; // passagem rápida / trânsito
    registros.push(r);
  };
  if (aberto && (aberto as Registro).lugarId && !ativos.has((aberto as Registro).lugarId!)) {
    fecharAberto((aberto as Registro).ultimoSinal);
  }

  const abrir = (
    lugarId: string | null,
    t: number,
    lat: number,
    lng: number,
    origem: Registro['origem'],
  ) => {
    if (lugarId !== null && registros.length > 0) {
      // Só funde com o registro imediatamente anterior (evita sobrepor outro lugar no meio).
      const i = registros.length - 1;
      const prev = registros[i]!;
      if (prev.lugarId === lugarId && prev.fim !== null && !prev.editado && t >= prev.fim && t - prev.fim <= FUSAO_MS) {
        registros.splice(i, 1);
        aberto = { ...prev, fim: null, ultimoSinal: t };
        return;
      }
    }
    aberto = {
      id: entrada.novoId(),
      lugarId,
      latitude: lat,
      longitude: lng,
      inicio: t,
      fim: null,
      ultimoSinal: t,
      origem,
      editado: false,
      ...(lugarId === null ? { amostras: 1 } : {}),
    };
  };

  const efetivo = (): Lugar | null => {
    let melhor: Lugar | null = null;
    let melhorDesde = 0;
    for (const [id, st] of Object.entries(dentro)) {
      const l = ativos.get(id);
      if (!l) continue;
      if (!melhor || l.raio < melhor.raio || (l.raio === melhor.raio && st.desde < melhorDesde)) {
        melhor = l;
        melhorDesde = st.desde;
      }
    }
    return melhor;
  };

  const itens: Item[] = [];
  for (const ev of entrada.eventos) {
    if (ev.seq > entrada.engine.cursorEvento) itens.push({ t: ev.ts, ordem: 0, ev });
  }
  for (const sa of entrada.amostras) {
    if (sa.seq > entrada.engine.cursorAmostra) itens.push({ t: sa.ts, ordem: 1, sa });
  }
  itens.sort((a, b) => a.t - b.t || a.ordem - b.ordem);

  let cursorEvento = entrada.engine.cursorEvento;
  let cursorAmostra = entrada.engine.cursorAmostra;

  const reconciliar = (t: number, amostra: NativeSample | null, saidas: Record<string, number>) => {
    const eff = efetivo();
    const atual = aberto as Registro | null;

    if (atual && atual.lugarId) {
      if (eff && eff.id === atual.lugarId) {
        aberto = { ...atual, ultimoSinal: Math.max(atual.ultimoSinal, t) };
        return;
      }
      // mudou de lugar efetivo (ou saiu): fecha na hora da saída conhecida/inferida
      fecharAberto(saidas[atual.lugarId] ?? t);
    }

    if (eff) {
      const desconhecido = aberto as Registro | null;
      if (desconhecido && desconhecido.lugarId === null) fecharAberto(desconhecido.ultimoSinal);
      abrir(eff.id, t, eff.latitude, eff.longitude, 'geofence');
      return;
    }

    // Sem lugar cadastrado: só amostras criam/estendem estadias desconhecidas.
    if (!amostra || amostra.acc > ACC_MAX_DESCONHECIDO) return;
    const u = aberto as Registro | null;
    if (
      u &&
      u.lugarId === null &&
      distanciaM(u.latitude, u.longitude, amostra.lat, amostra.lng) <= RAIO_DESCONHECIDO &&
      t - u.ultimoSinal <= LACUNA_MAXIMA_MS
    ) {
      const n = u.amostras ?? 1;
      aberto = {
        ...u,
        latitude: (u.latitude * n + amostra.lat) / (n + 1),
        longitude: (u.longitude * n + amostra.lng) / (n + 1),
        amostras: n + 1,
        ultimoSinal: t,
      };
      return;
    }
    if (u && u.lugarId === null) fecharAberto(u.ultimoSinal);
    abrir(null, t, amostra.lat, amostra.lng, 'amostra');
  };

  for (const it of itens) {
    const t = it.t;
    const saidas: Record<string, number> = {};
    if (it.ev) {
      cursorEvento = Math.max(cursorEvento, it.ev.seq);
      const l = ativos.get(it.ev.placeId);
      if (!l) continue;
      if (it.ev.type === 'ENTER') {
        const st = dentro[l.id];
        dentro[l.id] = st ? { desde: st.desde, visto: t } : { desde: t, visto: t };
      } else {
        delete dentro[l.id];
      }
      reconciliar(t, null, saidas);
    } else if (it.sa) {
      const s = it.sa;
      cursorAmostra = Math.max(cursorAmostra, s.seq);
      if (s.acc <= ACC_MAX_MEMBRO) {
        for (const l of ativos.values()) {
          const d = distanciaM(s.lat, s.lng, l.latitude, l.longitude);
          const st = dentro[l.id];
          if (d <= l.raio) {
            dentro[l.id] = st ? { desde: st.desde, visto: t } : { desde: t, visto: t };
          } else if (st && d - s.acc > l.raio) {
            // certamente fora, mas o EXIT nunca chegou: infere a saída
            saidas[l.id] = Math.min(t, st.visto + TETO_SILENCIO_MS);
            delete dentro[l.id];
          }
        }
      }
      reconciliar(t, s, saidas);
    }
  }

  const finalAberto = aberto as Registro | null;
  if (finalAberto) registros.push(finalAberto);
  registros.sort((a, b) => a.inicio - b.inicio);

  return {
    registros,
    engine: {
      dentro,
      abertoId: finalAberto ? finalAberto.id : null,
      epoch: entrada.engine.epoch,
      cursorEvento,
      cursorAmostra,
    },
  };
}

/** Depois de cadastrar um lugar, estadias passadas dentro do raio passam a pertencer a ele. */
export function reatribuirDesconhecidos(registros: Registro[], lugar: Lugar): Registro[] {
  return registros.map((r) => {
    if (r.lugarId !== null || r.fim === null) return r;
    if (distanciaM(r.latitude, r.longitude, lugar.latitude, lugar.longitude) > lugar.raio) return r;
    return { ...r, lugarId: lugar.id };
  });
}
