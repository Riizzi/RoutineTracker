import { App as CapApp } from '@capacitor/app';
import { CalendarDays, ChartColumn, MapPin, Navigation, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Lugar, Sugestao } from './core/types.ts';
import { native, type NativeStatus } from './native/bridge.ts';
import { cl4pCapturarDeepLink } from './services/cl4pLink.ts';
import { baixarAtualizacao, verificarSeFazUmDia, type InfoAtualizacao } from './services/atualizacao.ts';
import { usePublicarNoCl4p } from './services/cl4pRotina.ts';
import { iniciarNativo, marcarOnboarding, sincronizar, useEstado } from './store/store.ts';
import Agora from './ui/screens/Agora.tsx';
import Config from './ui/screens/Config.tsx';
import Extrato from './ui/screens/Extrato.tsx';
import Graficos from './ui/screens/Graficos.tsx';
import LugarForm, { type FormInicial } from './ui/screens/LugarForm.tsx';
import Lugares from './ui/screens/Lugares.tsx';
import { Onboarding } from './ui/screens/Permissoes.tsx';

type Aba = 'agora' | 'extrato' | 'graficos' | 'lugares' | 'config';

const ABAS: { id: Aba; rotulo: string; Icone: typeof Navigation }[] = [
  { id: 'agora', rotulo: 'Agora', Icone: Navigation },
  { id: 'extrato', rotulo: 'Extrato', Icone: CalendarDays },
  { id: 'graficos', rotulo: 'Gráficos', Icone: ChartColumn },
  { id: 'lugares', rotulo: 'Lugares', Icone: MapPin },
  { id: 'config', rotulo: 'Config', Icone: SlidersHorizontal },
];

export default function App() {
  const { onboardingVisto } = useEstado();
  usePublicarNoCl4p();
  const [aba, setAba] = useState<Aba>('agora');
  const [form, setForm] = useState<FormInicial | null>(null);
  const [status, setStatus] = useState<NativeStatus | null>(null);
  const permissaoAnterior = useRef<string>('');

  const atualizarStatus = useCallback(async () => {
    try {
      setStatus(await native.getStatus());
    } catch {
      /* plugin indisponível: mantém o último status */
    }
  }, []);

  // Permissão mudou (usuário voltou das configurações do Android): recadastra geofences.
  useEffect(() => {
    if (!status) return;
    const chave = `${status.fine}|${status.background}|${status.notifications}`;
    if (permissaoAnterior.current && permissaoAnterior.current !== chave) void iniciarNativo().then(atualizarStatus);
    permissaoAnterior.current = chave;
  }, [status, atualizarStatus]);

  // Inicialização + ciclo de vida
  useEffect(() => {
    void iniciarNativo().then(atualizarStatus);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void sincronizar().then(atualizarStatus);
    }, 30_000);
    const retomar = CapApp.addListener('resume', () => {
      void atualizarStatus();
      void sincronizar();
    });
    return () => {
      clearInterval(timer);
      void retomar.then((h) => h.remove());
    };
  }, [atualizarStatus]);

  // Toque na notificação "Novo lugar?" → routinetracker://novo-lugar?lat=..&lng=..
  useEffect(() => {
    const abrir = (url: string) => {
      try {
        const u = new URL(url);
        if (u.protocol === 'routinetracker:' && u.hostname === 'cl4p') {
          // Vínculo vindo do hub CL4P-RZ: routinetracker://cl4p?code=...
          if (cl4pCapturarDeepLink(url)) setAba('config');
          return;
        }
        if (u.protocol !== 'routinetracker:' || u.hostname !== 'novo-lugar') return;
        const lat = Number(u.searchParams.get('lat'));
        const lng = Number(u.searchParams.get('lng'));
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setAba('lugares');
          setForm({ latitude: lat, longitude: lng });
        }
      } catch {
        /* URL inválida */
      }
    };
    void CapApp.getLaunchUrl().then((r) => r?.url && abrir(r.url));
    const h = CapApp.addListener('appUrlOpen', (e) => abrir(e.url));
    return () => void h.then((x) => x.remove());
  }, []);

  // Botão voltar do Android
  useEffect(() => {
    const h = CapApp.addListener('backButton', () => {
      if (form) setForm(null);
      else if (aba !== 'agora') setAba('agora');
      else void CapApp.minimizeApp();
    });
    return () => void h.then((x) => x.remove());
  }, [form, aba]);

  const cadastrar = (s?: Sugestao) => setForm(s ? { latitude: s.latitude, longitude: s.longitude } : {});
  const editar = (l: Lugar) => setForm({ editar: l });

  const [nova, setNova] = useState<InfoAtualizacao | null>(null);
  useEffect(() => {
    verificarSeFazUmDia('Riizzi/RoutineTracker', 'RoutineTracker.apk').then((i) => i?.temNova && setNova(i)).catch(() => {});
  }, []);

  const faltaPermissao = native.isNative && status && (!status.fine || !status.background);

  if (native.isNative && status && !onboardingVisto && faltaPermissao) {
    return <Onboarding status={status} atualizar={() => void atualizarStatus()} onContinuar={marcarOnboarding} />;
  }

  return (
    <div className="h-full flex flex-col bg-[#FAF7F2]">
      <header className="pt-safe bg-[#FAF7F2] border-b border-[#E8DFD1] shrink-0">
        <div className="h-12 px-4 flex items-center justify-between">
          <h1 className="font-mono font-bold text-xs uppercase tracking-wider">RoutineTracker</h1>
          {status?.paused && <span className="text-[10px] font-mono font-bold text-[#BC5A42] uppercase">pausado</span>}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
        {faltaPermissao && (
          <button onClick={() => setAba('config')} className="w-full text-left bg-[#BC5A42]/8 border border-[#BC5A42]/30 rounded-xl p-3 mb-4 flex gap-2 items-start">
            <TriangleAlert className="w-5 h-5 text-[#BC5A42] shrink-0" />
            <span className="text-sm text-[#57534E]">
              <strong className="text-[#BC5A42]">Registro automático desligado.</strong> Falta permissão de localização “o tempo todo”. Toque para resolver.
            </span>
          </button>
        )}
        {nova && (
          <button onClick={() => baixarAtualizacao(nova)} className="w-full text-left bg-[#FFFDF9] border border-[#E8DFD1] rounded-xl p-3 mb-4 text-sm text-[#57534E]">
            <strong className="text-[#292524]">Versão nova disponível</strong> (build {nova.ultima}). Toque para baixar.
          </button>
        )}
        {aba === 'agora' && <Agora onCadastrar={cadastrar} />}
        {aba === 'extrato' && <Extrato />}
        {aba === 'graficos' && <Graficos />}
        {aba === 'lugares' && <Lugares onNovo={cadastrar} onEditar={editar} />}
        {aba === 'config' && status && <Config status={status} atualizarStatus={() => void atualizarStatus()} />}
      </main>

      <nav className="shrink-0 pb-safe bg-[#FFFDF9] border-t border-[#E8DFD1]">
        <div className="grid grid-cols-5 h-16">
          {ABAS.map(({ id, rotulo, Icone }) => (
            <button key={id} onClick={() => setAba(id)} className={`flex flex-col items-center justify-center gap-1 ${aba === id ? 'text-[#BC5A42]' : 'text-[#78716C]'}`}>
              <Icone className="w-5 h-5" />
              <span className="text-[10px] font-mono font-bold uppercase">{rotulo}</span>
            </button>
          ))}
        </div>
      </nav>

      {form && <LugarForm inicial={form} onFechar={() => setForm(null)} />}
    </div>
  );
}
