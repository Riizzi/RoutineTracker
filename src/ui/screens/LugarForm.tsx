import { ArrowLeft, LoaderCircle, LocateFixed, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CATEGORIAS, ORDEM_CATEGORIAS } from '../../core/categorias.ts';
import type { Categoria, Coordenada, Lugar } from '../../core/types.ts';
import { native } from '../../native/bridge.ts';
import { buscarEndereco, enderecoDe, type ResultadoBusca } from '../../services/geocode.ts';
import { adicionarLugar, atualizarLugar, getEstado } from '../../store/store.ts';
import { IconeCategoria } from '../icons.tsx';
import { Botao, Campo, Cartao, estiloInput, Rotulo } from '../kit.tsx';
import { MapaPicker } from '../MapaPicker.tsx';

export interface FormInicial {
  editar?: Lugar;
  latitude?: number;
  longitude?: number;
  nome?: string;
}

// Centro do Brasil: só usado se não houver localização nenhuma (o mapa é ajustável).
const CENTRO_PADRAO: Coordenada = { latitude: -14.235, longitude: -51.925 };

export default function LugarForm({ inicial, onFechar }: { inicial: FormInicial; onFechar: () => void }) {
  const editar = inicial.editar;
  const cfg = getEstado().config;
  const [nome, setNome] = useState(editar?.nome ?? inicial.nome ?? '');
  const [categoria, setCategoria] = useState<Categoria>(editar?.categoria ?? 'outro');
  const [raio, setRaio] = useState(editar?.raio ?? cfg.raioPadrao);
  const [endereco, setEndereco] = useState(editar?.endereco ?? '');
  const [centro, setCentro] = useState<Coordenada>(() => {
    if (editar) return { latitude: editar.latitude, longitude: editar.longitude };
    if (inicial.latitude !== undefined && inicial.longitude !== undefined) {
      return { latitude: inicial.latitude, longitude: inicial.longitude };
    }
    return CENTRO_PADRAO;
  });
  const [recentralizar, setRecentralizar] = useState(0);
  const [consulta, setConsulta] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusca[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [gpsOcupado, setGpsOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const enderecoEditado = useRef(!!editar?.endereco);
  const temPosicao = useRef(!!editar || inicial.latitude !== undefined);

  const irPara = (c: Coordenada) => {
    temPosicao.current = true;
    setCentro(c);
    setRecentralizar((n) => n + 1);
  };

  const usarGps = async (silencioso = false) => {
    setGpsOcupado(true);
    setAviso(null);
    try {
      if (!(await native.requestLocation())) throw new Error('Permissão de localização negada.');
      const p = await native.currentPosition();
      irPara({ latitude: p.latitude, longitude: p.longitude });
      if (p.precisao > 80 && !silencioso) setAviso(`Precisão do GPS: ~${Math.round(p.precisao)} m. Ajuste o mapa se precisar.`);
    } catch (e) {
      if (!silencioso) setAviso(e instanceof Error ? e.message : 'Não consegui obter sua localização.');
    } finally {
      setGpsOcupado(false);
    }
  };

  // Lugar novo sem posição: tenta centralizar onde a pessoa está (sem barulho se falhar).
  useEffect(() => {
    if (!temPosicao.current) void usarGps(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Endereço automático ao mover o pino (respeita a política de 1 req/s do Nominatim).
  useEffect(() => {
    if (enderecoEditado.current || !temPosicao.current) return;
    const t = setTimeout(() => {
      enderecoDe(centro.latitude, centro.longitude)
        .then((e) => {
          if (e && !enderecoEditado.current) setEndereco(e);
        })
        .catch(() => undefined);
    }, 1_500);
    return () => clearTimeout(t);
  }, [centro]);

  const buscar = async () => {
    const q = consulta.trim();
    if (q.length < 3) return;
    setBuscando(true);
    setAviso(null);
    try {
      const r = await buscarEndereco(q);
      setResultados(r);
      if (r.length === 0) setAviso('Nada encontrado. Tente incluir a cidade.');
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Erro na busca.');
    } finally {
      setBuscando(false);
    }
  };

  const escolher = (r: ResultadoBusca) => {
    setResultados(null);
    enderecoEditado.current = false;
    setEndereco(r.endereco);
    if (!nome.trim()) setNome(r.titulo);
    irPara({ latitude: r.latitude, longitude: r.longitude });
  };

  const podeSalvar = nome.trim().length > 0 && temPosicao.current;

  const salvar = () => {
    if (!podeSalvar) return;
    const dados = {
      nome: nome.trim(),
      categoria,
      latitude: centro.latitude,
      longitude: centro.longitude,
      raio,
      endereco: endereco.trim(),
    };
    if (editar) atualizarLugar(editar.id, dados);
    else adicionarLugar(dados);
    onFechar();
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#FAF7F2] flex flex-col">
      <header className="pt-safe bg-[#FAF7F2] border-b border-[#E8DFD1]">
        <div className="flex items-center justify-between px-3 h-14">
          <button onClick={onFechar} className="p-2 -ml-1 text-[#57534E]" aria-label="Voltar">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xs font-mono font-bold uppercase">{editar ? 'Editar lugar' : 'Novo lugar'}</h1>
          <Botao variante="primario" onClick={salvar} desabilitado={!podeSalvar} className="min-h-10 px-5">
            Salvar
          </Botao>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-safe">
        <Cartao className="space-y-3">
          <Rotulo>1 · Onde fica?</Rotulo>
          <div className="flex gap-2">
            <input
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void buscar()}
              placeholder="Endereço ou nome do local"
              enterKeyHint="search"
              className={estiloInput}
            />
            <Botao onClick={() => void buscar()} desabilitado={buscando || consulta.trim().length < 3} className="px-3" >
              {buscando ? <LoaderCircle className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            </Botao>
          </div>
          {resultados && resultados.length > 0 && (
            <ul className="border border-[#E8DFD1] rounded-xl divide-y divide-[#E8DFD1] overflow-hidden">
              {resultados.map((r, i) => (
                <li key={i}>
                  <button onClick={() => escolher(r)} className="w-full text-left px-3 py-2.5 bg-[#FFFDF9] active:bg-[#FAF7F2]">
                    <p className="text-sm font-bold text-[#292524] line-clamp-1">{r.titulo}</p>
                    <p className="text-xs text-[#78716C] line-clamp-2">{r.endereco}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <MapaPicker centro={centro} raio={raio} recentralizar={recentralizar} onMover={(c) => { temPosicao.current = true; setCentro(c); }} />
          <Botao onClick={() => void usarGps()} desabilitado={gpsOcupado} className="w-full flex items-center justify-center gap-2">
            {gpsOcupado ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
            Usar minha localização atual
          </Botao>
          {aviso && <p className="text-xs text-[#BC5A42]">{aviso}</p>}
          <p className="text-xs text-[#78716C]">Arraste o mapa até o pino ficar sobre o lugar.</p>
        </Cartao>

        <Cartao className="space-y-4">
          <Rotulo>2 · Detalhes</Rotulo>
          <Campo rotulo="Nome">
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Academia, Escritório, Casa da vó" className={estiloInput} maxLength={40} />
          </Campo>

          <div className="space-y-1.5">
            <span className="text-[11px] font-mono uppercase text-[#78716C]">Categoria</span>
            <div className="grid grid-cols-4 gap-2">
              {ORDEM_CATEGORIAS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategoria(c)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[11px] font-bold ${
                    categoria === c ? 'border-[#292524] bg-[#FAF7F2]' : 'border-[#E8DFD1] bg-[#FFFDF9]'
                  }`}
                >
                  <IconeCategoria categoria={c} className="w-5 h-5" />
                  {CATEGORIAS[c].label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono uppercase text-[#78716C]">
              <span>Raio da cerca</span>
              <span className="font-bold text-[#4E6A8A]">{raio} m</span>
            </div>
            <input type="range" min={100} max={500} step={25} value={raio} onChange={(e) => setRaio(Number(e.target.value))} className="w-full accent-[#4E6A8A]" />
            <p className="text-xs text-[#78716C]">
              Mínimo 100 m (limite de precisão do Android). Locais grandes (shopping, campus) pedem raios maiores.
            </p>
          </div>

          <Campo rotulo="Endereço (opcional)">
            <input
              value={endereco}
              onChange={(e) => { enderecoEditado.current = true; setEndereco(e.target.value); }}
              className={estiloInput}
              maxLength={200}
            />
          </Campo>
        </Cartao>
      </div>
    </div>
  );
}
