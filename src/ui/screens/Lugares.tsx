import { MapPin, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { CATEGORIAS } from '../../core/categorias.ts';
import { calcularSugestoes } from '../../core/discovery.ts';
import { fmtDataCurta, fmtDuracao } from '../../core/time.ts';
import type { Lugar, Sugestao } from '../../core/types.ts';
import { alternarLugar, ignorarSugestao, removerLugar, useAgora, useEstado } from '../../store/store.ts';
import { IconeCategoria } from '../icons.tsx';
import { Botao, Cartao, Rotulo, Vazio } from '../kit.tsx';

export default function Lugares({ onNovo, onEditar }: { onNovo: (s?: Sugestao) => void; onEditar: (l: Lugar) => void }) {
  const { lugares, registros, ignorados, config } = useEstado();
  const agora = useAgora(60_000);
  const sugestoes = calcularSugestoes(registros, lugares, ignorados, { descobertaMinutos: config.descobertaMinutos }, agora);

  const excluir = (l: Lugar) => {
    if (window.confirm(`Excluir "${l.nome}"? O histórico é mantido como "sem cadastro".`)) removerLugar(l.id);
  };

  return (
    <div className="space-y-5">
      {sugestoes.length > 0 && (
        <section className="space-y-2">
          <Rotulo>Lugares sugeridos</Rotulo>
          {sugestoes.map((s) => (
            <Cartao key={s.id} className="bg-[#FFF9F0] border-[#C68B59]/50">
              <p className="font-bold text-sm">
                {fmtDuracao(s.minutos)} em {s.visitas} {s.visitas === 1 ? 'visita' : 'visitas'}
                {s.atual ? ' · você está aqui' : ''}
              </p>
              <p className="text-xs text-[#78716C] mt-0.5">
                {fmtDataCurta(s.primeira)}{s.visitas > 1 ? ` a ${fmtDataCurta(s.ultima)}` : ''} · {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
              </p>
              <div className="flex gap-2 mt-3">
                <Botao variante="primario" className="flex-1" onClick={() => onNovo(s)}>Cadastrar</Botao>
                <Botao variante="suave" onClick={() => ignorarSugestao(s)}>Ignorar</Botao>
              </div>
            </Cartao>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <Rotulo>Meus lugares ({lugares.length})</Rotulo>
        </div>
        {lugares.length === 0 ? (
          <Vazio icone={<MapPin className="w-7 h-7" />} titulo="Nenhum lugar ainda" texto="Cadastre casa, trabalho, academia… O registro passa a ser automático." />
        ) : (
          lugares.map((l) => (
            <div key={l.id} className={`bg-[#FFFDF9] retro-shadow-sm rounded-xl p-3 flex items-center gap-3 ${l.ativo ? '' : 'opacity-50'}`}>
              <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] shrink-0">
                <IconeCategoria categoria={l.categoria} className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm truncate">{l.nome}</p>
                <p className="text-xs text-[#78716C] truncate">{l.endereco || CATEGORIAS[l.categoria].label}</p>
                <p className="text-[10px] font-mono uppercase text-[#A8A29E] mt-0.5">raio {l.raio} m{l.ativo ? '' : ' · desativado'}</p>
              </div>
              <div className="flex shrink-0">
                <button onClick={() => alternarLugar(l.id, !l.ativo)} className={`p-2.5 ${l.ativo ? 'text-[#5F8575]' : 'text-[#A8A29E]'}`} aria-label={l.ativo ? 'Desativar' : 'Ativar'}>
                  <Power className="w-4.5 h-4.5" />
                </button>
                <button onClick={() => onEditar(l)} className="p-2.5 text-[#78716C]" aria-label="Editar">
                  <Pencil className="w-4.5 h-4.5" />
                </button>
                <button onClick={() => excluir(l)} className="p-2.5 text-[#78716C]" aria-label="Excluir">
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>
          ))
        )}
        <Botao variante="primario" className="w-full flex items-center justify-center gap-2" onClick={() => onNovo()}>
          <Plus className="w-5 h-5" /> Novo lugar
        </Botao>
      </section>
    </div>
  );
}
