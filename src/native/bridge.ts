import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type { Coordenada, NativeEvent, NativeSample } from '../core/types.ts';

export interface NativeStatus {
  fine: boolean;
  coarse: boolean;
  background: boolean;
  notifications: boolean;
  locationEnabled: boolean;
  batteryUnrestricted: boolean;
  paused: boolean;
  geofences: number;
  lastSampleTs: number;
  lastEventTs: number;
  lastSync: string;
  lastError: string;
  sdk: number;
}

export interface NativePlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  r: number;
}

export interface NativeConfig {
  discoveryMin: number;
  summaryHour: number;
  summaryOn: boolean;
  statusOn: boolean;
}

export interface NativePull {
  epoch: string;
  events: NativeEvent[];
  samples: NativeSample[];
  ignored: { lat: number; lng: number }[];
}

interface RoutineNativePlugin {
  getStatus(): Promise<NativeStatus>;
  requestBackground(): Promise<{ granted: boolean }>;
  requestNotifications(): Promise<{ granted: boolean }>;
  openAppSettings(): Promise<void>;
  openBatterySettings(): Promise<void>;
  openLocationSettings(): Promise<void>;
  setPlaces(o: { places: NativePlace[] }): Promise<{ registered: number; message: string }>;
  setConfig(o: NativeConfig): Promise<void>;
  start(): Promise<void>;
  setPaused(o: { paused: boolean }): Promise<void>;
  pull(): Promise<NativePull>;
  ack(o: { eventSeq: number; sampleSeq: number }): Promise<void>;
}

const Plugin = registerPlugin<RoutineNativePlugin>('RoutineNative');

export const isNative = Capacitor.isNativePlatform();

/** No navegador (npm run dev) não há Android: tudo "concedido" e sem eventos, só para ver a interface. */
const statusWeb: NativeStatus = {
  fine: true,
  coarse: true,
  background: true,
  notifications: true,
  locationEnabled: true,
  batteryUnrestricted: true,
  paused: false,
  geofences: 0,
  lastSampleTs: 0,
  lastEventTs: 0,
  lastSync: 'pré-visualização no navegador',
  lastError: '',
  sdk: 0,
};

const vazio = { epoch: 'web', events: [], samples: [], ignored: [] } satisfies NativePull;

export const native = {
  isNative,
  getStatus: (): Promise<NativeStatus> => (isNative ? Plugin.getStatus() : Promise.resolve(statusWeb)),
  requestBackground: async () => (isNative ? Plugin.requestBackground() : { granted: true }),
  requestNotifications: async () => (isNative ? Plugin.requestNotifications() : { granted: true }),
  openAppSettings: async () => {
    if (isNative) await Plugin.openAppSettings();
  },
  openBatterySettings: async () => {
    if (isNative) await Plugin.openBatterySettings();
  },
  openLocationSettings: async () => {
    if (isNative) await Plugin.openLocationSettings();
  },
  setPlaces: async (places: NativePlace[]) =>
    isNative ? Plugin.setPlaces({ places }) : { registered: 0, message: 'web' },
  setConfig: async (c: NativeConfig) => {
    if (isNative) await Plugin.setConfig(c);
  },
  start: async () => {
    if (isNative) await Plugin.start();
  },
  setPaused: async (paused: boolean) => {
    if (isNative) await Plugin.setPaused({ paused });
  },
  pull: async (): Promise<NativePull> => (isNative ? Plugin.pull() : vazio),
  ack: async (eventSeq: number, sampleSeq: number) => {
    if (isNative) await Plugin.ack({ eventSeq, sampleSeq });
  },

  /** Permissão de localização em primeiro plano (diálogo padrão do Android). */
  requestLocation: async (): Promise<boolean> => {
    const r = await Geolocation.requestPermissions({ permissions: ['location'] });
    return r.location === 'granted';
  },
  /** Posição atual com GPS (para "usar minha localização" ao cadastrar um lugar). */
  currentPosition: async (): Promise<Coordenada & { precisao: number }> => {
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20_000 });
    return { latitude: p.coords.latitude, longitude: p.coords.longitude, precisao: p.coords.accuracy };
  },
};
