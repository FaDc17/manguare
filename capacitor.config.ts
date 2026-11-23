import type { CapacitorConfig } from '@capacitor/cli';

// El APK de prueba consume la API HTTP del ordenador en la misma red.
// La sincronización normal conserva HTTPS para una futura versión publicada.
const localMvp = process.env.MANGUARE_LOCAL_MVP === '1';

const config: CapacitorConfig = {
  appId: 'pe.manguare.app',
  appName: 'Manguaré',
  webDir: 'web/dist',
  server: {
    androidScheme: localMvp ? 'http' : 'https',
    ...(localMvp ? { cleartext: true } : {}),
  },
};

export default config;
