import { ChartColumn } from 'lucide-react';
import { useState } from 'react';
import { CATEGORIAS, ORDEM_CATEGORIAS } from '../../core/categorias.ts';
import { diasNaSemana, mediaDiasAtivos, periodo } from '../../core/stats.ts';
import { fmtDuracao } from '../../core/time.ts';
import type { CategoriaStat } from '../../core/types.ts';
import { useAgora, useEstado } from '../../store/store.ts';
import { IconeCategoria } from '../icons.tsx';
import { Cartao, Rotulo, Vazio } from '../kit.tsx';

const CATS: CategoriaStat[] = [...ORDEM_CATEGORIAS, 'desconhecido'];

export default function Graficos() {
  const { lugares, registros, config } = useEstado();
  const agora = useAgora(60_000);
  const [n, setN] = useState<7 | 30>(7);

  const atual = periodo(registros, lugares, agora, n, 0);
  const anterior = periodo(registros, lugares, agora, n, 1);

  if (registros.length === 0) {
    return <Vazio icone={<ChartColumn className="w-7 h-7" />} titulo="Ainda sem dados" texto="Os gráficos aparecem depois dos primeiros dias de uso." />;
  }

  const maxDia = Math.max(8 * 60, ...atual.dias.map((d) => d.total));
  const ranking = Object.entries(atual.porLugar).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxRank = ranking[0]?.[1] ?? 1;

  const trabalhoHoje = atual.dias[atual.dias.length - 1]?.porCategoria.trabalho ?? 0;
  const diasAcimaMeta = atual.dias.filter((d) => (d.porCategoria.trabalho ?? 0) > config.metaTrabalhoHoras * 60).length;
  const academiaSemana = diasNaSemana(registros, lugares, 'saude', agora);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 p-1 bg-[#EFE9DE] rounded-xl">
        {([7, 30] as const).map((v) => (
          <button key={v} onClick={() => setN(v)} className={`py-2 rounded-lg text-sm font-bold ${n === v ? 'bg-[#FFFDF9] retro-shadow-sm' : 'text-[#78716C]'}`}>
            {v} dias
          </button>
        ))}
      </div>

      <Cartao className="space-y-3">
        <Rotulo>Horas por dia</Rotulo>
        <div className="h-40 flex items-end gap-[3px] border-b border-[#E8DFD1]">
          {atual.dias.map((d) => (
            <div key={d.dia} className="flex-1 h-full flex flex-col justify-end" title={d.dia}>
              <div className="w-full rounded-t overflow-hidden flex flex-col-reverse" style={{ height: `${Math.max(2, (d.total / maxDia) * 100)}%` }}>
                {CATS.map((c) => {
                  const m = d.porCategoria[c] ?? 0;
                  return m > 0 ? <div key={c} style={{ height: `${(m / d.total) * 100}%`, backgroundColor: CATEGORIAS[c].cor }} /> : null;
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] font-mono text-[#78716C]">
          <span>{new Date(atual.dias[0]!.inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
          <span>escala máx. {Math.round(maxDia / 60)}h</span>
          <span>hoje</span>
        </div>
      </Cartao>

      <Cartao className="space-y-3">
        <Rotulo>Por categoria (vs. {n} dias anteriores)</Rotulo>
        {CATS.filter((c) => (atual.porCategoria[c] ?? 0) > 0 || (anterior.porCategoria[c] ?? 0) > 0).map((c) => {
          const a = atual.porCategoria[c] ?? 0;
          const b = anterior.porCategoria[c] ?? 0;
          const delta = b > 0 ? Math.round(((a - b) / b) * 100) : null;
          return (
            <div key={c} className="flex items-center gap-3">
              <IconeCategoria categoria={c} className="w-5 h-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{CATEGORIAS[c].label}</p>
                <p className="text-[11px] font-mono text-[#78716C]">média {fmtDuracao(mediaDiasAtivos(atual.dias, c))} nos dias com presença</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-sm">{fmtDuracao(a)}</p>
                {delta !== null && (
                  <p className={`text-[11px] font-mono ${delta >= 0 ? 'text-[#5F8575]' : 'text-[#BC5A42]'}`}>{delta >= 0 ? '+' : ''}{delta}%</p>
                )}
              </div>
            </div>
          );
        })}
      </Cartao>

      {ranking.length > 0 && (
        <Cartao className="space-y-3">
          <Rotulo>Lugares mais frequentes</Rotulo>
          {ranking.map(([id, min]) => {
            const l = lugares.find((x) => x.id === id);
            if (!l) return null;
            return (
              <div key={id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-bold truncate">{l.nome}</span>
                  <span className="font-mono text-[#4E6A8A] font-bold">{fmtDuracao(min)}</span>
                </div>
                <div className="h-2 bg-[#FAF7F2] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(min / maxRank) * 100}%`, backgroundColor: CATEGORIAS[l.categoria].cor }} />
                </div>
              </div>
            );
          })}
        </Cartao>
      )}

      <Cartao className="space-y-4">
        <Rotulo>Metas</Rotulo>
        <Meta rotulo={`Trabalho hoje (máx. ${config.metaTrabalhoHoras}h)`} valor={trabalhoHoje / 60} max={config.metaTrabalhoHoras} texto={fmtDuracao(trabalhoHoje)} invertido />
        <p className="text-xs text-[#78716C] -mt-2">
          {diasAcimaMeta === 0 ? `Nenhum dia acima da meta nos últimos ${n} dias.` : `${diasAcimaMeta} dia(s) acima da meta nos últimos ${n} dias.`}
        </p>
        <Meta rotulo={`Academia esta semana (${config.metaAcademiaSemana}x)`} valor={academiaSemana} max={config.metaAcademiaSemana} texto={`${academiaSemana}/${config.metaAcademiaSemana}`} />
      </Cartao>
    </div>
  );
}

function Meta({ rotulo, valor, max, texto, invertido }: { rotulo: string; valor: number; max: number; texto: string; invertido?: boolean }) {
  const pct = Math.min(100, (valor / Math.max(max, 0.01)) * 100);
  const estourou = invertido && valor > max;
  const cumpriu = !invertido && valor >= max;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-bold">{rotulo}</span>
        <span className="font-mono font-bold">{texto}</span>
      </div>
      <div className="h-2.5 bg-[#FAF7F2] border border-[#E8DFD1] rounded-full overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: estourou ? '#BC5A42' : cumpriu ? '#5F8575' : '#4E6A8A' }} />
      </div>
    </div>
  );
}
