import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { CATEGORIAS } from '../../core/categorias.ts';
import { addDias, fmtDataCurta, fmtDuracao, fmtHora, fromInputLocal, inicioDoDia, toInputLocal } from '../../core/time.ts';
import type { Registro } from '../../core/types.ts';
import { adicionarRegistroManual, atualizarRegistro, removerRegistro, useAgora, useEstado } from '../../store/store.ts';
import { BarraDia } from '../BarraDia.tsx';
import { IconeCategoria } from '../icons.tsx';
import { Botao, Campo, Cartao, estiloInput, Folha, Vazio } from '../kit.tsx';

type Edicao = { modo: 'editar'; registro: Registro } | { modo: 'novo' };

export default function Extrato() {
  const { lugares, registros } = useEstado();
  const agora = useAgora(30_000);
  const [dia, setDia] = useState(() => inicioDoDia(Date.now()));
  const [edicao, setEdicao] = useState<Edicao | null>(null);

  const fimDia = addDias(dia, 1);
  const linhas = registros
    .filter((r) => r.inicio < fimDia && (r.fim ?? agora) > dia)
    .map((r) => ({ r, a: Math.max(r.inicio, dia), b: Math.min(r.fim ?? agora, fimDia) }))
    .sort((x, y) => x.a - y.a);

  const ehHoje = dia === inicioDoDia(agora);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setDia(addDias(dia, -1))} className="p-3 -ml-2 text-[#57534E]" aria-label="Dia anterior">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button onClick={() => setDia(inicioDoDia(agora))} className="text-center">
          <p className="font-bold first-letter:uppercase">{fmtDataCurta(dia)}</p>
          {!ehHoje && <p className="text-[11px] font-mono text-[#BC5A42] uppercase">voltar para hoje</p>}
        </button>
        <button onClick={() => setDia(addDias(dia, 1))} disabled={ehHoje} className="p-3 -mr-2 text-[#57534E] disabled:opacity-30" aria-label="Próximo dia">
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      <Cartao>
        <BarraDia registros={registros} lugares={lugares} dia={dia} agora={agora} />
      </Cartao>

      {linhas.length === 0 ? (
        <Vazio icone={<CalendarPlus className="w-7 h-7" />} titulo="Nada neste dia" texto="Sem registros. Se você esteve em algum lugar cadastrado, pode lançar manualmente." />
      ) : (
        <div className="space-y-2">
          {linhas.map(({ r, a, b }, i) => {
            const l = r.lugarId ? lugares.find((x) => x.id === r.lugarId) : undefined;
            const cat = l?.categoria ?? 'desconhecido';
            const anterior = linhas[i - 1];
            const lacuna = anterior ? (a - anterior.b) / 60_000 : 0;
            return (
              <div key={r.id}>
                {lacuna >= 10 && (
                  <p className="text-center text-[11px] font-mono text-[#A8A29E] py-1">· · · fora dos lugares {fmtDuracao(lacuna)} · · ·</p>
                )}
                <button onClick={() => setEdicao({ modo: 'editar', registro: r })} className="w-full text-left bg-[#FFFDF9] retro-shadow-sm rounded-xl px-3 py-3 flex items-center gap-3 retro-press">
                  <span className="w-1.5 self-stretch rounded-full" style={{ backgroundColor: CATEGORIAS[cat].cor }} />
                  <IconeCategoria categoria={cat} className="w-5 h-5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-sm truncate">{l?.nome ?? 'Sem cadastro'}</span>
                    <span className="block text-xs font-mono text-[#78716C]">
                      {r.inicio < dia ? '←' : ''}{fmtHora(a)} – {r.fim === null && b === agora ? 'agora' : fmtHora(b)}{r.fim !== null && r.fim > fimDia ? ' →' : ''}
                      {r.editado ? ' · editado' : ''}
                    </span>
                  </span>
                  <span className="font-mono font-bold text-sm text-[#4E6A8A]">{fmtDuracao((b - a) / 60_000)}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Botao onClick={() => setEdicao({ modo: 'novo' })} className="w-full" desabilitado={lugares.length === 0}>
        + Lançamento manual
      </Botao>

      {edicao && <FolhaRegistro edicao={edicao} dia={dia} onFechar={() => setEdicao(null)} />}
    </div>
  );
}

function FolhaRegistro({ edicao, dia, onFechar }: { edicao: Edicao; dia: number; onFechar: () => void }) {
  const { lugares } = useEstado();
  const r = edicao.modo === 'editar' ? edicao.registro : null;
  const emAberto = !!r && r.fim === null;
  const [lugarId, setLugarId] = useState<string>(r?.lugarId ?? lugares[0]?.id ?? '');
  const [inicio, setInicio] = useState(toInputLocal(r?.inicio ?? dia + 9 * 3_600_000));
  const [fim, setFim] = useState(toInputLocal(r?.fim ?? dia + 10 * 3_600_000));
  const [erro, setErro] = useState<string | null>(null);

  const salvar = () => {
    const i = fromInputLocal(inicio);
    const f = fromInputLocal(fim);
    if (!emAberto && !(f > i)) return setErro('O fim precisa ser depois do início.');
    if (r) {
      atualizarRegistro(r.id, { lugarId: lugarId || null, inicio: i, ...(emAberto ? {} : { fim: f }) });
    } else {
      if (!lugarId) return setErro('Escolha um lugar.');
      adicionarRegistroManual(lugarId, i, f);
    }
    onFechar();
  };

  return (
    <Folha titulo={r ? 'Editar lançamento' : 'Lançamento manual'} onFechar={onFechar}>
      <Campo rotulo="Lugar">
        <select value={lugarId} onChange={(e) => setLugarId(e.target.value)} className={estiloInput}>
          {r && <option value="">Sem cadastro</option>}
          {lugares.map((l) => (
            <option key={l.id} value={l.id}>{l.nome}</option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Início">
        <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} className={estiloInput} />
      </Campo>
      {emAberto ? (
        <p className="text-sm text-[#78716C]">Este lançamento está em andamento; o fim será registrado quando você sair.</p>
      ) : (
        <Campo rotulo="Fim">
          <input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} className={estiloInput} />
        </Campo>
      )}
      {erro && <p className="text-sm text-[#BC5A42]">{erro}</p>}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Botao variante="primario" onClick={salvar}>Salvar</Botao>
        {r ? (
          <Botao variante="perigo" onClick={() => { removerRegistro(r.id); onFechar(); }}>Excluir</Botao>
        ) : (
          <Botao variante="suave" onClick={onFechar}>Cancelar</Botao>
        )}
      </div>
    </Folha>
  );
}
