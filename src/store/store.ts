import { useEffect, useState, useSyncExternalStore } from 'react';
import { engineInicial, processar, reatribuirDesconhecidos } from '../core/engine.ts';
import { distanciaM } from '../core/geo.ts';
import type { Config, Coordenada, EngineState, Lugar, Registro, Sugestao } from '../core/types.ts';
import { native, type NativeConfig, type NativePlace } from '../native/bridge.ts';

const CHAVE = 'rt.estado.v1';

export const CONFIG_PADRAO: Config = {
  raioPadrao: 150,
  minutosMinimos: 5,
  descobertaMinutos: 30,
  avisoMinutos: 120,
  resumoAtivo: true,
  resumoHora: 22,
  statusAtivo: true,
  metaTrabalhoHoras: 9,
  metaAcademiaSemana: 4,
};

export interface Estado {
  versao: 1;
  lugares: Lugar[];
  registros: Registro[];
  engine: EngineState;
  ignorados: Coordenada[];
  config: Config;
  onboardingVisto: boolean;
  /** não persistidos */
  ultimoSync: number | null;
  erroSync: string | null;
}

const estadoVazio = (): Estado => ({
  versao: 1,
  lugares: [],
  registros: [],
  engine: engineInicial(),
  ignorados: [],
  config: { ...CONFIG_PADRAO },
  onboardingVisto: false,
  ultimoSync: null,
  erroSync: null,
});

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ------------------------------------------------------------------ persistência

function carregar(): Estado {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return estadoVazio();
    const p = JSON.parse(bruto) as Partial<Estado>;
    if (!Array.isArray(p.lugares) || !Array.isArray(p.registros)) return estadoVazio();
    return {
      ...estadoVazio(),
      ...p,
      engine: { ...engineInicial(), ...(p.engine ?? {}) },
      config: { ...CONFIG_PADRAO, ...(p.config ?? {}) },
      ignorados: Array.isArray(p.ignorados) ? p.ignorados : [],
      ultimoSync: null,
      erroSync: null,
    };
  } catch {
    return estadoVazio();
  }
}

let estado: Estado = carregar();
const ouvintes = new Set<() => void>();
let timerSalvar: ReturnType<typeof setTimeout> | null = null;

function salvarAgora() {
  timerSalvar = null;
  try {
    const { ultimoSync: _a, erroSync: _b, ...persistir } = estado;
    void _a;
    void _b;
    localStorage.setItem(CHAVE, JSON.stringify(persistir));
  } catch (e) {
    console.error('Falha ao salvar', e);
  }
}

function agendarSalvar() {
  if (timerSalvar) clearTimeout(timerSalvar);
  timerSalvar = setTimeout(salvarAgora, 250);
}

if (typeof window !== 'undefined') {
  const flush = () => {
    if (timerSalvar) salvarAgora();
  };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

const persistivelMudou = (a: Estado, b: Estado) =>
  a.lugares !== b.lugares || a.registros !== b.registros || a.engine !== b.engine ||
  a.ignorados !== b.ignorados || a.config !== b.config || a.onboardingVisto !== b.onboardingVisto;

function setEstado(f: (s: Estado) => Estado) {
  const anterior = estado;
  estado = f(estado);
  if (persistivelMudou(anterior, estado)) agendarSalvar();
  ouvintes.forEach((l) => l());
}

export const getEstado = () => estado;

export function useEstado(): Estado {
  return useSyncExternalStore(
    (cb) => {
      ouvintes.add(cb);
      return () => ouvintes.delete(cb);
    },
    () => estado,
  );
}

/** Relógio para a interface (durações "ao vivo"). */
export function useAgora(intervaloMs = 30_000): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return agora;
}

// ------------------------------------------------------------------ nativo

const lugaresParaNativo = (lugares: Lugar[]): NativePlace[] =>
  lugares.filter((l) => l.ativo).map((l) => ({ id: l.id, name: l.nome, lat: l.latitude, lng: l.longitude, r: l.raio }));

const configParaNativo = (c: Config): NativeConfig => ({
  discoveryMin: c.avisoMinutos,
  summaryHour: c.resumoHora,
  summaryOn: c.resumoAtivo,
  statusOn: c.statusAtivo,
});

/** Reenvia todos os lugares ativos ao Android (recadastra as geofences). Idempotente. */
export async function enviarLugares(): Promise<string> {
  try {
    const r = await native.setPlaces(lugaresParaNativo(estado.lugares));
    return r.message;
  } catch (e) {
    return `erro: ${String(e)}`;
  }
}

/** Liga tudo no lado nativo. Seguro chamar sempre que o app abrir ou uma permissão mudar. */
export async function iniciarNativo(): Promise<void> {
  try {
    await native.setConfig(configParaNativo(estado.config));
    await enviarLugares();
    await native.start();
  } catch (e) {
    setEstado((s) => ({ ...s, erroSync: String(e) }));
  }
  await sincronizar();
}

function fecharAberto(registros: Registro[], abertoId: string | null): Registro[] {
  if (!abertoId) return registros;
  return registros.map((r) =>
    r.id === abertoId && r.fim === null ? { ...r, fim: Math.max(r.inicio, r.ultimoSinal) } : r,
  );
}

function mesclarIgnorados(atuais: Coordenada[], novos: { lat: number; lng: number }[]): Coordenada[] {
  let mudou = false;
  const out = atuais.slice();
  for (const n of novos) {
    if (!out.some((i) => distanciaM(i.latitude, i.longitude, n.lat, n.lng) < 50)) {
      out.push({ latitude: n.lat, longitude: n.lng });
      mudou = true;
    }
  }
  return mudou ? out : atuais;
}

let sincronizando: Promise<void> | null = null;

/** Puxa o que o Android acumulou (eventos de geofence + amostras), processa e confirma. */
export function sincronizar(): Promise<void> {
  if (sincronizando) return sincronizando;
  sincronizando = (async () => {
    try {
      const pull = await native.pull();
      let maxEv = 0;
      let maxSa = 0;
      // Processa dentro do updater: se o usuário editou algo durante o await, nada é perdido.
      setEstado((s) => {
        let engine = s.engine;
        let registros = s.registros;
        if (engine.epoch !== pull.epoch) {
          // Armazenamento nativo foi recriado (dados do app limpos, por ex.): cursores antigos não valem.
          registros = fecharAberto(registros, engine.abertoId);
          engine = { ...engineInicial(), epoch: pull.epoch };
        }
        const out = processar({
          lugares: s.lugares,
          registros,
          engine,
          eventos: pull.events,
          amostras: pull.samples,
          minutosMinimos: s.config.minutosMinimos,
          novoId: uuid,
        });
        maxEv = out.engine.cursorEvento;
        maxSa = out.engine.cursorAmostra;
        return {
          ...s,
          registros: out.registros,
          engine: out.engine,
          ignorados: mesclarIgnorados(s.ignorados, pull.ignored),
          ultimoSync: Date.now(),
          erroSync: null,
        };
      });
      await native.ack(maxEv, maxSa);
    } catch (e) {
      setEstado((s) => ({ ...s, erroSync: String(e) }));
    } finally {
      sincronizando = null;
    }
  })();
  return sincronizando;
}

// ------------------------------------------------------------------ ações: lugares

export type NovoLugar = Pick<Lugar, 'nome' | 'categoria' | 'latitude' | 'longitude' | 'raio' | 'endereco'>;

export function adicionarLugar(dados: NovoLugar): Lugar {
  const lugar: Lugar = { ...dados, id: uuid(), ativo: true, criadoEm: Date.now() };
  setEstado((s) => ({
    ...s,
    lugares: [...s.lugares, lugar],
    // estadias passadas dentro do raio (ex.: o fim de semana que motivou o cadastro) passam a ser do lugar
    registros: reatribuirDesconhecidos(s.registros, lugar),
  }));
  void enviarLugares().then(sincronizar);
  return lugar;
}

export function atualizarLugar(id: string, patch: Partial<NovoLugar>) {
  setEstado((s) => ({ ...s, lugares: s.lugares.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  void enviarLugares();
}

export function alternarLugar(id: string, ativo: boolean) {
  setEstado((s) => ({ ...s, lugares: s.lugares.map((l) => (l.id === id ? { ...l, ativo } : l)) }));
  void enviarLugares().then(sincronizar);
}

export function removerLugar(id: string) {
  setEstado((s) => {
    const alvo = s.lugares.find((l) => l.id === id);
    return {
      ...s,
      lugares: s.lugares.filter((l) => l.id !== id),
      // o histórico é preservado como "sem cadastro"; e o local não volta a ser sugerido
      registros: s.registros.map((r) => (r.lugarId === id ? { ...r, lugarId: null } : r)),
      ignorados: alvo ? [...s.ignorados, { latitude: alvo.latitude, longitude: alvo.longitude }] : s.ignorados,
    };
  });
  void enviarLugares().then(sincronizar);
}

export function ignorarSugestao(sug: Pick<Sugestao, 'latitude' | 'longitude'>) {
  setEstado((s) => ({ ...s, ignorados: [...s.ignorados, { latitude: sug.latitude, longitude: sug.longitude }] }));
}

// ------------------------------------------------------------------ ações: registros

export function atualizarRegistro(id: string, patch: Partial<Pick<Registro, 'lugarId' | 'inicio' | 'fim'>>) {
  setEstado((s) => ({
    ...s,
    registros: s.registros
      .map((r) => (r.id === id ? { ...r, ...patch, editado: true } : r))
      .sort((a, b) => a.inicio - b.inicio),
  }));
}

export function removerRegistro(id: string) {
  setEstado((s) => ({
    ...s,
    registros: s.registros.filter((r) => r.id !== id),
    engine: s.engine.abertoId === id ? { ...s.engine, abertoId: null } : s.engine,
  }));
}

export function adicionarRegistroManual(lugarId: string, inicio: number, fim: number) {
  setEstado((s) => {
    const l = s.lugares.find((x) => x.id === lugarId);
    if (!l) return s;
    const r: Registro = {
      id: uuid(),
      lugarId,
      latitude: l.latitude,
      longitude: l.longitude,
      inicio,
      fim,
      ultimoSinal: fim,
      origem: 'manual',
      editado: true,
    };
    return { ...s, registros: [...s.registros, r].sort((a, b) => a.inicio - b.inicio) };
  });
}

// ------------------------------------------------------------------ configuração / geral

export function atualizarConfig(patch: Partial<Config>) {
  setEstado((s) => ({ ...s, config: { ...s.config, ...patch } }));
  void native.setConfig(configParaNativo(estado.config));
}

export function marcarOnboarding() {
  setEstado((s) => ({ ...s, onboardingVisto: true }));
}

/** Apaga TUDO (lugares e histórico). Confirma os eventos nativos pendentes para não reprocessá-los. */
export async function apagarTudo() {
  const pull = await native.pull();
  const maxEv = pull.events.reduce((m, e) => Math.max(m, e.seq), 0);
  const maxSa = pull.samples.reduce((m, e) => Math.max(m, e.seq), 0);
  await native.ack(maxEv, maxSa);
  setEstado(() => ({
    ...estadoVazio(),
    onboardingVisto: true,
    engine: { ...engineInicial(), epoch: pull.epoch, cursorEvento: maxEv, cursorAmostra: maxSa },
  }));
  await enviarLugares();
}

// ------------------------------------------------------------------ backup

const TIPO_BACKUP = 'routinetracker-backup';

export function gerarBackupJSON(): string {
  const s = estado;
  return JSON.stringify(
    {
      tipo: TIPO_BACKUP,
      versao: 1,
      geradoEm: new Date().toISOString(),
      lugares: s.lugares,
      registros: s.registros,
      ignorados: s.ignorados,
      config: s.config,
    },
    null,
    1,
  );
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const CATS = ['casa', 'trabalho', 'saude', 'lazer', 'estudo', 'social', 'transporte', 'outro'];

/** Valida e substitui os dados pelo backup. Lança Error com mensagem legível se o arquivo for inválido. */
export function importarBackupJSON(texto: string) {
  let o: unknown;
  try {
    o = JSON.parse(texto);
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }
  const b = o as Record<string, unknown>;
  if (!b || b.tipo !== TIPO_BACKUP || !Array.isArray(b.lugares) || !Array.isArray(b.registros)) {
    throw new Error('Este arquivo não é um backup do RoutineTracker.');
  }
  const lugares: Lugar[] = [];
  for (const x of b.lugares as Record<string, unknown>[]) {
    if (
      typeof x.id !== 'string' || typeof x.nome !== 'string' || !CATS.includes(String(x.categoria)) ||
      !num(x.latitude) || !num(x.longitude) || !num(x.raio)
    ) {
      throw new Error('Backup com lugar inválido.');
    }
    lugares.push({
      id: x.id, nome: x.nome, categoria: x.categoria as Lugar['categoria'], latitude: x.latitude,
      longitude: x.longitude, raio: x.raio, endereco: typeof x.endereco === 'string' ? x.endereco : '',
      ativo: x.ativo !== false, criadoEm: num(x.criadoEm) ? x.criadoEm : Date.now(),
    });
  }
  const registros: Registro[] = [];
  for (const x of b.registros as Record<string, unknown>[]) {
    if (typeof x.id !== 'string' || !num(x.inicio) || !(x.fim === null || num(x.fim)) || !num(x.latitude) || !num(x.longitude)) {
      throw new Error('Backup com registro inválido.');
    }
    registros.push({
      id: x.id,
      lugarId: typeof x.lugarId === 'string' ? x.lugarId : null,
      latitude: x.latitude, longitude: x.longitude, inicio: x.inicio, fim: x.fim as number | null,
      ultimoSinal: num(x.ultimoSinal) ? x.ultimoSinal : (x.fim as number | null) ?? x.inicio,
      origem: x.origem === 'geofence' || x.origem === 'manual' ? x.origem : 'amostra',
      editado: x.editado === true,
    });
  }
  setEstado((s) => ({
    ...s,
    lugares,
    registros: registros.sort((a, c) => a.inicio - c.inicio),
    ignorados: Array.isArray(b.ignorados) ? (b.ignorados as Coordenada[]).filter((i) => num(i.latitude) && num(i.longitude)) : [],
    config: { ...CONFIG_PADRAO, ...((b.config as Partial<Config>) ?? {}) },
    // registros abertos importados não têm mais correspondência com o estado do motor
    engine: { ...engineInicial(), epoch: s.engine.epoch, cursorEvento: s.engine.cursorEvento, cursorAmostra: s.engine.cursorAmostra },
  }));
  void iniciarNativo();
}

function csvCampo(v: string): string {
  return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function gerarCSV(): string {
  const s = estado;
  const nome = new Map(s.lugares.map((l) => [l.id, l]));
  const d = (ts: number) => new Date(ts).toLocaleString('pt-BR', { hour12: false });
  const linhas = ['inicio;fim;duracao_min;lugar;categoria;origem'];
  for (const r of s.registros) {
    const l = r.lugarId ? nome.get(r.lugarId) : undefined;
    const fim = r.fim ?? Date.now();
    linhas.push(
      [
        d(r.inicio),
        r.fim === null ? 'em andamento' : d(r.fim),
        String(Math.round((fim - r.inicio) / 60_000)),
        csvCampo(l?.nome ?? 'Sem cadastro'),
        l?.categoria ?? 'desconhecido',
        r.origem,
      ].join(';'),
    );
  }
  return '\uFEFF' + linhas.join('\r\n');
}
