import { useState } from 'react';
import { baixarAtualizacao, verificarAtualizacao, type InfoAtualizacao } from '../services/atualizacao.ts';

/** Cartão "Versão do app": mostra a versão instalada, verifica a última em Releases e baixa o APK. */
export default function AtualizacaoCard({ repo, apk }: { repo: string; apk: string }) {
  const [info, setInfo] = useState<InfoAtualizacao | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const verificar = async () => {
    setCarregando(true);
    setMsg(null);
    try {
      const i = await verificarAtualizacao(repo, apk);
      setInfo(i);
      if (!i.temNova) setMsg(i.instalada ? `Você está na versão mais recente (build ${i.instalada}).` : `Última versão publicada: build ${i.ultima}.`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="bg-[#FFFDF9] border border-[#E8DFD1] rounded-2xl p-4 space-y-3" style={{ boxShadow: '2px 2px 0 #E5DCD0' }}>
      <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#57534E]">Versão do app</h3>
      <p className="text-xs text-[#78716C] leading-relaxed">
        A versão nova instala por cima da atual, sem apagar nada. Depois do download, toque na notificação para instalar.
      </p>
      {info?.temNova ? (
        <button type="button" onClick={() => baixarAtualizacao(info)} className="w-full min-h-11 rounded-xl text-sm font-bold bg-[#292524] text-[#FAF7F2]">
          Baixar build {info.ultima} (você tem a {info.instalada})
        </button>
      ) : (
        <button type="button" onClick={() => void verificar()} disabled={carregando} className="w-full min-h-11 rounded-xl text-sm font-bold bg-[#FAF7F2] text-[#292524] border border-[#E8DFD1] disabled:opacity-50">
          {carregando ? 'Verificando…' : 'Verificar atualização'}
        </button>
      )}
      {msg && <p className="text-xs text-[#57534E]">{msg}</p>}
    </div>
  );
}
