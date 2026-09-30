import { BatteryCharging, Bell, CircleCheck, Circle, MapPin, Navigation, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { native, type NativeStatus } from '../../native/bridge.ts';
import { Botao } from '../kit.tsx';

interface Item {
  ok: boolean;
  icone: ReactNode;
  titulo: string;
  texto: string;
  acao?: { rotulo: string; fazer: () => void };
}

export function itensPermissao(st: NativeStatus, atualizar: () => void): Item[] {
  const depois = (f: () => Promise<unknown>) => () => void f().finally(atualizar);
  return [
    {
      ok: st.fine,
      icone: <MapPin className="w-5 h-5" />,
      titulo: 'Localização precisa',
      texto: 'Necessária para saber em que lugar você está.',
      acao: { rotulo: 'Permitir', fazer: depois(() => native.requestLocation().then(() => native.requestBackground().catch(() => undefined))) },
    },
    {
      ok: st.background,
      icone: <Navigation className="w-5 h-5" />,
      titulo: 'Permitir o tempo todo',
      texto: 'Sem isso o Android para de avisar o app quando ele está fechado. Na tela que abrir, escolha “Permitir o tempo todo”.',
      acao: {
        rotulo: st.fine ? 'Permitir' : 'Abrir ajustes',
        fazer: depois(() => (st.fine ? native.requestBackground() : native.openAppSettings())),
      },
    },
    {
      ok: st.locationEnabled,
      icone: <ShieldCheck className="w-5 h-5" />,
      titulo: 'Localização do aparelho ligada',
      texto: 'O botão de localização do Android precisa estar ativado.',
      acao: { rotulo: 'Abrir', fazer: depois(() => native.openLocationSettings()) },
    },
    {
      ok: st.notifications,
      icone: <Bell className="w-5 h-5" />,
      titulo: 'Notificações',
      texto: 'Para o lugar atual, resumo do dia e perguntas de “lugar novo”.',
      acao: { rotulo: 'Permitir', fazer: depois(() => native.requestNotifications().then((r) => (r.granted ? undefined : native.openAppSettings()))) },
    },
    {
      ok: st.batteryUnrestricted,
      icone: <BatteryCharging className="w-5 h-5" />,
      titulo: 'Bateria sem restrições',
      texto: 'Recomendado. Alguns celulares (Samsung, Xiaomi, Motorola) encerram apps em segundo plano. Escolha “Sem restrições” para este app.',
      acao: { rotulo: 'Ajustar', fazer: depois(() => native.openBatterySettings()) },
    },
  ];
}

export function ListaPermissoes({ status, atualizar }: { status: NativeStatus; atualizar: () => void }) {
  return (
    <div className="space-y-3">
      {itensPermissao(status, atualizar).map((it) => (
        <div key={it.titulo} className="flex gap-3 items-start">
          <span className={it.ok ? 'text-[#5F8575]' : 'text-[#BC5A42]'}>{it.ok ? <CircleCheck className="w-5 h-5" /> : <Circle className="w-5 h-5" />}</span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm flex items-center gap-1.5">{it.icone}{it.titulo}</p>
            <p className="text-xs text-[#78716C] leading-relaxed mt-0.5">{it.texto}</p>
            {!it.ok && it.acao && (
              <Botao className="mt-2 min-h-9 py-1 text-xs" onClick={it.acao.fazer}>{it.acao.rotulo}</Botao>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Tela inicial que explica e pede as permissões. */
export function Onboarding({ status, atualizar, onContinuar }: { status: NativeStatus; atualizar: () => void; onContinuar: () => void }) {
  const essencial = status.fine && status.background;
  return (
    <div className="fixed inset-0 z-50 bg-[#FAF7F2] overflow-y-auto pt-safe pb-safe">
      <div className="p-5 space-y-5 max-w-md mx-auto">
        <div className="pt-4 space-y-2">
          <h1 className="text-2xl font-bold">Vamos ativar o registro automático</h1>
          <p className="text-sm text-[#57534E] leading-relaxed">
            O RoutineTracker usa a localização apenas no seu aparelho para saber quando você chega e sai dos seus lugares. Nada é enviado a servidores.
          </p>
        </div>
        <div className="bg-[#FFFDF9] retro-shadow rounded-2xl p-4">
          <ListaPermissoes status={status} atualizar={atualizar} />
        </div>
        <Botao variante="primario" className="w-full" onClick={onContinuar} desabilitado={!essencial}>
          Continuar
        </Botao>
        <button onClick={onContinuar} className="w-full text-center text-sm text-[#78716C] py-2">
          Agora não (o registro automático ficará desligado)
        </button>
      </div>
    </div>
  );
}
