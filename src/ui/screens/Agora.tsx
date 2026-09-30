import { Footprints, MapPin, Plus } from 'lucide-react';
import { CATEGORIAS } from '../../core/categorias.ts';
import { calcularSugestoes } from '../../core/discovery.ts';
import { estatisticasPorDia } from '../../core/stats.ts';
import { fmtDuracao, fmtHora, inicioDoDia } from '../../core/time.ts';
import type { Sugestao } from '../../core/types.ts';
import { ignorarSugestao, useAgora, useEstado } from '../../store/store.ts';
import { BarraDia } from '../BarraDia.tsx';
import { IconeCategoria } from '../icons.tsx';
import { Botao, Cartao, Rotulo, Vazio } from '../kit.tsx';

interface Props {
  onCadastrar: (s?: Sugestao) => void;
}

export default function Agora({ onCadastrar }: Props) {
  const { lugares, registros, engine, ignorados, config } = useEstado();
  const agora = useAgora(30_000);

  const aberto = registros.find((r) => r.id === engine.abertoId && r.fim === null) ?? null;
  const lugarAtual = aberto?.lugarId ? lugares.find((l) => l.id === aberto.lugarId) ?? null : null;
  const hoje = inicioDoDia(agora);
  const dias = estatisticasPorDia(registros, lugares, agora, hoje, hoje);
  const dia = dias[0];

  const sugestoes = calcularSugestoes(registros, lugares, ignorados, { descobertaMinutos: config.descobertaMinutos }, agora);
  const sugestaoTopo = sugestoes[0];

  if (lugares.length === 0) {
    return (
      <Vazio
        icone={<MapPin className="w-7 h-7" />}
        titulo="Cadastre seu primeiro lugar"
        texto="Comece por onde você passa mais tempo: casa, trabalho, academia. O app registra sozinho quando você chega e sai."
      >
        <Botao variante="primario" onClick={() => onCadastrar()} className="mt-2">
          Cadastrar lugar
        </Botao>
      </Vazio>
    );
  }

  const minutosDesconhecido = aberto && !aberto.lugarId ? (aberto.ultimoSinal - aberto.inicio) / 60_000 : 0;

  return (
    <div className="space-y-4">
      {lugarAtual && aberto ? (
        <Cartao className="relative overflow-hidden">
          <span className="absolute top-0 right-0 bg-[#5F8575]/15 border-l border-b border-[#E8DFD1] text-[#4E7060] font-mono text-[10px] font-bold px-3 py-1 uppercase rounded-bl-xl">
            presente
          </span>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1]">
              <IconeCategoria categoria={lugarAtual.categoria} className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-mono text-[#78716C] uppercase">{CATEGORIAS[lugarAtual.categoria].label}</p>
              <h2 className="text-xl font-bold text-[#292524] truncate">{lugarAtual.nome}</h2>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-dashed border-[#E8DFD1] flex justify-between text-sm">
            <span className="text-[#78716C]">
              Desde <strong className="text-[#292524]">{fmtHora(aberto.inicio)}</strong>
            </span>
            <span className="text-[#78716C]">
              Há <strong className="text-[#4E6A8A]">{fmtDuracao((agora - aberto.inicio) / 60_000)}</strong>
            </span>
          </div>
        </Cartao>
      ) : aberto && !aberto.lugarId && minutosDesconhecido >= 20 ? (
        <Cartao className="relative overflow-hidden">
          <span className="absolute top-0 right-0 bg-[#C68B59]/15 border-l border-b border-[#E8DFD1] text-[#8A5A2B] font-mono text-[10px] font-bold px-3 py-1 uppercase rounded-bl-xl">
            local novo
          </span>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1]">
              <IconeCategoria categoria="desconhecido" className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-mono text-[#78716C] uppercase">Lugar não cadastrado</p>
              <h2 className="text-xl font-bold text-[#292524]">Você está aqui há {fmtDuracao(minutosDesconhecido)}</h2>
            </div>
          </div>
          <Botao
            variante="primario"
            className="w-full mt-3"
            onClick={() => onCadastrar({ id: aberto.id, latitude: aberto.latitude, longitude: aberto.longitude, visitas: 1, minutos: Math.round(minutosDesconhecido), primeira: aberto.inicio, ultima: aberto.ultimoSinal, atual: true })}
          >
            Cadastrar este lugar
          </Botao>
        </Cartao>
      ) : (
        <Cartao className="relative overflow-hidden">
          <span className="absolute top-0 right-0 bg-[#78716C]/10 border-l border-b border-[#E8DFD1] text-[#57534E] font-mono text-[10px] font-bold px-3 py-1 uppercase rounded-bl-xl">
            fora
          </span>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] text-[#78716C]">
              <Footprints className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-mono text-[#78716C] uppercase">Monitorando</p>
              <h2 className="text-xl font-bold text-[#292524]">Fora dos seus lugares</h2>
            </div>
          </div>
        </Cartao>
      )}

      {sugestaoTopo && !sugestaoTopo.atual && (
        <Cartao className="border-[#C68B59]/50 bg-[#FFF9F0]">
          <p className="text-sm font-bold text-[#292524]">Lugar novo por aqui?</p>
          <p className="text-sm text-[#57534E] mt-1">
            Você ficou {fmtDuracao(sugestaoTopo.minutos)} num lugar não cadastrado
            {sugestaoTopo.visitas > 1 ? ` (${sugestaoTopo.visitas} visitas)` : ''}.
          </p>
          <div className="flex gap-2 mt-3">
            <Botao variante="primario" className="flex-1" onClick={() => onCadastrar(sugestaoTopo)}>
              <Plus className="w-4 h-4 inline -mt-0.5 mr-1" />
              Cadastrar
            </Botao>
            <Botao variante="suave" onClick={() => ignorarSugestao(sugestaoTopo)}>
              Ignorar
            </Botao>
          </div>
        </Cartao>
      )}

      <Cartao className="space-y-3">
        <Rotulo>Hoje</Rotulo>
        <BarraDia registros={registros} lugares={lugares} dia={hoje} agora={agora} />
      </Cartao>

      <div className="space-y-2">
        <Rotulo>Tempo por lugar hoje</Rotulo>
        {dia && Object.keys(dia.porLugar).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(dia.porLugar)
              .sort((a, b) => b[1] - a[1])
              .map(([id, min]) => {
                const l = lugares.find((x) => x.id === id);
                if (!l) return null;
                return (
                  <div key={id} className="bg-[#FFFDF9] retro-shadow-sm rounded-xl px-3 py-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-2.5 min-w-0">
                      <IconeCategoria categoria={l.categoria} className="w-5 h-5 shrink-0" />
                      <span className="text-sm font-bold truncate">{l.nome}</span>
                    </span>
                    <span className="text-sm font-mono font-bold text-[#4E6A8A]">{fmtDuracao(min)}</span>
                  </div>
                );
              })}
          </div>
        ) : (
          <p className="text-sm text-[#78716C]">Ainda sem registros hoje. Os lugares aparecem aqui quando você chegar a algum deles.</p>
        )}
      </div>
    </div>
  );
}
