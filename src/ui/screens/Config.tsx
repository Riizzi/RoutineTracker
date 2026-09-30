import { useRef, useState } from 'react';
import { native, type NativeStatus } from '../../native/bridge.ts';
import { compartilharArquivo, lerArquivoTexto } from '../../services/arquivos.ts';
import { apagarTudo, atualizarConfig, gerarBackupJSON, gerarCSV, getEstado, importarBackupJSON, sincronizar, useEstado } from '../../store/store.ts';
import { carregarDemo } from '../../store/demo.ts';
import { Botao, Cartao, Chave, Rotulo } from '../kit.tsx';
import { ListaPermissoes } from './Permissoes.tsx';

const Linha = ({ rotulo, detalhe, children }: { rotulo: string; detalhe?: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 min-h-11">
    <div className="min-w-0">
      <p className="text-sm font-bold">{rotulo}</p>
      {detalhe && <p className="text-xs text-[#78716C]">{detalhe}</p>}
    </div>
    {children}
  </div>
);

const Numero = ({ valor, min, max, passo = 1, unidade, onChange }: { valor: number; min: number; max: number; passo?: number; unidade: string; onChange: (v: number) => void }) => (
  <div className="flex items-center gap-1.5 shrink-0">
    <button className="w-9 h-9 rounded-lg bg-[#FAF7F2] border border-[#E8DFD1] font-bold" onClick={() => onChange(Math.max(min, valor - passo))} aria-label="Diminuir">−</button>
    <span className="w-16 text-center text-sm font-mono font-bold">{valor}{unidade}</span>
    <button className="w-9 h-9 rounded-lg bg-[#FAF7F2] border border-[#E8DFD1] font-bold" onClick={() => onChange(Math.min(max, valor + passo))} aria-label="Aumentar">+</button>
  </div>
);

const fmtTs = (t: number) => (t ? new Date(t).toLocaleString('pt-BR', { hour12: false }) : '—');

export default function Config({ status, atualizarStatus }: { status: NativeStatus; atualizarStatus: () => void }) {
  const { config, ultimoSync, erroSync, lugares, registros } = useEstado();
  const [msg, setMsg] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const tudoOk = status.fine && status.background && status.locationEnabled && status.notifications && status.batteryUnrestricted;

  const executar = async (f: () => Promise<void>, ok: string) => {
    try {
      await f();
      setMsg(ok);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const importar = async (f: File | undefined) => {
    if (!f) return;
    if (!window.confirm('Importar substitui TODOS os lugares e registros atuais. Continuar?')) return;
    await executar(async () => importarBackupJSON(await lerArquivoTexto(f)), 'Backup importado.');
    if (arquivo.current) arquivo.current.value = '';
  };

  const apagar = async () => {
    if (!window.confirm('Apagar TODOS os lugares e registros? Isso não pode ser desfeito.')) return;
    await executar(apagarTudo, 'Dados apagados.');
  };

  return (
    <div className="space-y-4">
      <Cartao className="space-y-3">
        <Rotulo>Permissões {tudoOk ? '· tudo certo' : '· atenção'}</Rotulo>
        {tudoOk ? <p className="text-sm text-[#4E7060]">Tudo configurado para o registro automático.</p> : <ListaPermissoes status={status} atualizar={atualizarStatus} />}
      </Cartao>

      <Cartao className="space-y-1">
        <Rotulo className="mb-2">Rastreamento</Rotulo>
        <Linha rotulo="Pausar rastreamento" detalhe="Desliga geofences, amostras e notificações até você reativar.">
          <Chave rotulo="Pausar" ligada={status.paused} onChange={(v) => void native.setPaused(v).then(atualizarStatus)} />
        </Linha>
        <Linha rotulo="Lugar atual na barra de notificações">
          <Chave rotulo="Notificação de status" ligada={config.statusAtivo} onChange={(v) => atualizarConfig({ statusAtivo: v })} />
        </Linha>
        <Linha rotulo="Resumo diário" detalhe="Notificação com o tempo em cada lugar.">
          <Chave rotulo="Resumo diário" ligada={config.resumoAtivo} onChange={(v) => atualizarConfig({ resumoAtivo: v })} />
        </Linha>
        {config.resumoAtivo && (
          <Linha rotulo="Horário do resumo">
            <Numero valor={config.resumoHora} min={0} max={23} unidade="h" onChange={(v) => atualizarConfig({ resumoHora: v })} />
          </Linha>
        )}
      </Cartao>

      <Cartao className="space-y-1">
        <Rotulo className="mb-2">Ajustes</Rotulo>
        <Linha rotulo="Raio padrão" detalhe="Ao cadastrar um lugar novo.">
          <Numero valor={config.raioPadrao} min={100} max={500} passo={25} unidade="m" onChange={(v) => atualizarConfig({ raioPadrao: v })} />
        </Linha>
        <Linha rotulo="Permanência mínima" detalhe="Visitas mais curtas são ignoradas.">
          <Numero valor={config.minutosMinimos} min={1} max={30} unidade="min" onChange={(v) => atualizarConfig({ minutosMinimos: v })} />
        </Linha>
        <Linha rotulo="Sugerir lugar após" detalhe="Tempo acumulado fora dos lugares cadastrados.">
          <Numero valor={config.descobertaMinutos} min={15} max={240} passo={15} unidade="min" onChange={(v) => atualizarConfig({ descobertaMinutos: v })} />
        </Linha>
        <Linha rotulo="Avisar (notificação) após" detalhe="Permanência contínua num lugar novo.">
          <Numero valor={config.avisoMinutos} min={30} max={480} passo={30} unidade="min" onChange={(v) => atualizarConfig({ avisoMinutos: v })} />
        </Linha>
        <Linha rotulo="Meta: trabalho máx./dia">
          <Numero valor={config.metaTrabalhoHoras} min={1} max={16} unidade="h" onChange={(v) => atualizarConfig({ metaTrabalhoHoras: v })} />
        </Linha>
        <Linha rotulo="Meta: academia/semana">
          <Numero valor={config.metaAcademiaSemana} min={1} max={7} unidade="x" onChange={(v) => atualizarConfig({ metaAcademiaSemana: v })} />
        </Linha>
      </Cartao>

      <Cartao className="space-y-2">
        <Rotulo>Seus dados</Rotulo>
        <p className="text-xs text-[#78716C]">Tudo fica só neste aparelho. Faça backup de vez em quando (desinstalar o app apaga os dados).</p>
        <div className="grid grid-cols-2 gap-2">
          <Botao onClick={() => void executar(() => compartilharArquivo(`routinetracker-backup-${new Date().toISOString().slice(0, 10)}.json`, gerarBackupJSON(), 'application/json'), 'Backup gerado.')}>Backup (JSON)</Botao>
          <Botao onClick={() => void executar(() => compartilharArquivo('routinetracker-registros.csv', gerarCSV(), 'text/csv'), 'CSV gerado.')}>Exportar CSV</Botao>
          <Botao onClick={() => arquivo.current?.click()}>Importar backup</Botao>
          <Botao variante="perigo" onClick={() => void apagar()}>Apagar tudo</Botao>
        </div>
        <input ref={arquivo} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void importar(e.target.files?.[0])} />
        {msg && <p className="text-sm text-[#4E6A8A]">{msg}</p>}
      </Cartao>

      <Cartao className="space-y-1.5">
        <Rotulo>Diagnóstico</Rotulo>
        <dl className="text-xs font-mono text-[#57534E] space-y-1">
          <div>Lugares / registros: {lugares.length} / {registros.length}</div>
          <div>Geofences ativas: {status.geofences} — {status.lastSync || '—'}</div>
          <div>Último evento de geofence: {fmtTs(status.lastEventTs)}</div>
          <div>Última amostra de localização: {fmtTs(status.lastSampleTs)}</div>
          <div>Última sincronização: {fmtTs(ultimoSync ?? 0)}</div>
          {(status.lastError || erroSync) && <div className="text-[#BC5A42] break-words">Erro: {erroSync ?? status.lastError}</div>}
          <div>Android API {status.sdk || '—'}</div>
        </dl>
        <div className="flex gap-2 pt-1">
          <Botao className="min-h-9 py-1 text-xs" onClick={() => void sincronizar().then(atualizarStatus)}>Sincronizar agora</Botao>
          {!native.isNative && getEstado().lugares.length === 0 && <Botao className="min-h-9 py-1 text-xs" onClick={carregarDemo}>Dados de demonstração</Botao>}
        </div>
      </Cartao>
    </div>
  );
}
