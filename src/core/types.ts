export type Categoria =
  | 'casa'
  | 'trabalho'
  | 'saude'
  | 'lazer'
  | 'estudo'
  | 'social'
  | 'transporte'
  | 'outro';

/** Categoria usada nas estatísticas (inclui estadias em locais não cadastrados). */
export type CategoriaStat = Categoria | 'desconhecido';

export interface Lugar {
  id: string;
  nome: string;
  categoria: Categoria;
  latitude: number;
  longitude: number;
  /** raio da geofence em metros */
  raio: number;
  endereco: string;
  ativo: boolean;
  criadoEm: number;
}

export interface Registro {
  id: string;
  /** null = estadia em local não cadastrado */
  lugarId: string | null;
  latitude: number;
  longitude: number;
  inicio: number;
  /** null = ainda presente */
  fim: number | null;
  /** última vez que houve evidência de que a pessoa continuava ali */
  ultimoSinal: number;
  origem: 'geofence' | 'amostra' | 'manual';
  editado: boolean;
  /** nº de amostras agrupadas (só estadias desconhecidas) */
  amostras?: number;
}

export interface Coordenada {
  latitude: number;
  longitude: number;
}

export interface Config {
  raioPadrao: number;
  /** permanência mínima para registrar uma visita a um lugar cadastrado */
  minutosMinimos: number;
  /** tempo acumulado em local desconhecido para sugerir cadastro (lista na aba Lugares) */
  descobertaMinutos: number;
  /** permanência contínua num local desconhecido que dispara a notificação "cadastrar?" */
  avisoMinutos: number;
  resumoAtivo: boolean;
  resumoHora: number;
  statusAtivo: boolean;
  metaTrabalhoHoras: number;
  metaAcademiaSemana: number;
}

export interface EngineState {
  /** lugares em que a pessoa está (geofence) → desde quando / última evidência */
  dentro: Record<string, { desde: number; visto: number }>;
  abertoId: string | null;
  epoch: string | null;
  cursorEvento: number;
  cursorAmostra: number;
}

export interface NativeEvent {
  seq: number;
  type: 'ENTER' | 'EXIT';
  placeId: string;
  ts: number;
  lat?: number;
  lng?: number;
}

export interface NativeSample {
  seq: number;
  ts: number;
  lat: number;
  lng: number;
  acc: number;
}

export interface Sugestao {
  id: string;
  latitude: number;
  longitude: number;
  visitas: number;
  minutos: number;
  primeira: number;
  ultima: number;
  /** true se a pessoa está nesse local agora */
  atual: boolean;
}
