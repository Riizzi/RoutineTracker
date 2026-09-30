import L from 'leaflet';
import { MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { distanciaM } from '../core/geo.ts';
import type { Coordenada } from '../core/types.ts';

interface Props {
  centro: Coordenada;
  raio: number;
  /** disparado quando o usuário para de arrastar o mapa */
  onMover: (c: Coordenada) => void;
  /** incrementar para forçar o mapa a recentralizar (busca / GPS) */
  recentralizar: number;
}

/**
 * Mapa com pino fixo no centro: o usuário arrasta o MAPA até o ponto certo (padrão de apps de
 * corrida/entrega, mais preciso no toque do que arrastar um marcador). O círculo mostra o raio da geofence.
 */
export function MapaPicker({ centro, raio, onMover, recentralizar }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const circulo = useRef<L.Circle | null>(null);
  const centroRef = useRef(centro);
  const onMoverRef = useRef(onMover);
  const [falhasTile, setFalhasTile] = useState(0);
  centroRef.current = centro;
  onMoverRef.current = onMover;

  useEffect(() => {
    if (!el.current || mapa.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView(
      [centroRef.current.latitude, centroRef.current.longitude],
      17,
    );
    m.attributionControl.setPrefix(false);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    });
    tiles.on('tileerror', () => setFalhasTile((n) => n + 1));
    tiles.on('tileload', () => setFalhasTile(0));
    tiles.addTo(m);
    circulo.current = L.circle([centroRef.current.latitude, centroRef.current.longitude], {
      radius: raio,
      color: '#BC5A42',
      weight: 2,
      fillColor: '#BC5A42',
      fillOpacity: 0.15,
    }).addTo(m);
    m.on('move', () => circulo.current?.setLatLng(m.getCenter()));
    m.on('moveend', () => {
      const c = m.getCenter();
      const atual = centroRef.current;
      // O Leaflet também dispara moveend ao recalcular o tamanho, sem o usuário mexer: ignora.
      if (distanciaM(atual.latitude, atual.longitude, c.lat, c.lng) < 0.5) return;
      onMoverRef.current({ latitude: c.lat, longitude: c.lng });
    });
    mapa.current = m;
    // o contêiner só tem tamanho final depois do primeiro layout
    setTimeout(() => m.invalidateSize(), 60);
    return () => {
      m.remove();
      mapa.current = null;
      circulo.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    circulo.current?.setRadius(raio);
  }, [raio]);

  useEffect(() => {
    if (recentralizar === 0) return;
    mapa.current?.setView([centroRef.current.latitude, centroRef.current.longitude], Math.max(mapa.current.getZoom(), 17));
  }, [recentralizar]);

  return (
    <div className="relative h-64 rounded-2xl overflow-hidden border border-[#E8DFD1]">
      <div ref={el} className="absolute inset-0" />
      {/* pino fixo: a ponta fica exatamente no centro do mapa */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-[500]">
        <MapPin className="w-9 h-9 text-[#BC5A42] fill-[#BC5A42]/25" strokeWidth={2.2} />
      </div>
      {falhasTile >= 3 && (
        <div className="absolute inset-x-2 bottom-7 z-[500] bg-[#FFFDF9]/95 border border-[#E8DFD1] rounded-lg px-3 py-2 text-xs text-[#57534E]">
          Não consegui carregar o mapa (sem internet?). Você ainda pode usar “Minha localização” ou a busca.
        </div>
      )}
    </div>
  );
}
