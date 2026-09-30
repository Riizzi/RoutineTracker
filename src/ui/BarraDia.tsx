import { CATEGORIAS } from '../core/categorias.ts';
import { addDias, inicioDoDia } from '../core/time.ts';
import type { CategoriaStat, Lugar, Registro } from '../core/types.ts';

/** Linha do tempo de um dia: cada estadia posicionada na hora real (lacunas aparecem como vazio). */
export function BarraDia({ registros, lugares, dia, agora }: { registros: Registro[]; lugares: Lugar[]; dia: number; agora: number }) {
  const ini = inicioDoDia(dia);
  const fim = addDias(ini, 1);
  const total = fim - ini;
  const cat = new Map(lugares.map((l) => [l.id, l.categoria]));

  const segmentos = registros
    .map((r) => {
      const a = Math.max(r.inicio, ini);
      const b = Math.min(r.fim ?? agora, fim);
      return { r, a, b };
    })
    .filter((s) => s.b > s.a);

  return (
    <div className="space-y-1.5">
      <div className="relative h-6 bg-[#FAF7F2] border border-[#E8DFD1] rounded-lg overflow-hidden">
        {segmentos.map(({ r, a, b }) => {
          const c: CategoriaStat = r.lugarId ? (cat.get(r.lugarId) ?? 'desconhecido') : 'desconhecido';
          return (
            <div
              key={r.id}
              className="absolute top-0 h-full border-r border-[#FAF7F2]/60"
              style={{ left: `${((a - ini) / total) * 100}%`, width: `${((b - a) / total) * 100}%`, backgroundColor: CATEGORIAS[c].cor }}
            />
          );
        })}
        {segmentos.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-[#A8A29E]">
            nenhum registro
          </div>
        )}
      </div>
      <div className="flex justify-between text-[10px] text-[#78716C] font-mono px-0.5">
        <span>00h</span>
        <span>06h</span>
        <span>12h</span>
        <span>18h</span>
        <span>24h</span>
      </div>
    </div>
  );
}
