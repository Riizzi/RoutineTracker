import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.routinetracker',
  appName: 'RoutineTracker',
  webDir: 'dist',
  backgroundColor: '#FAF7F2',
  plugins: {
    // App claro (papel creme): ícones escuros na barra de status/navegação.
    SystemBars: { style: 'LIGHT' },
  },
};

export default config;
