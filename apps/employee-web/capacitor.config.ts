import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.buildacre.hrms',
  appName: 'BA Workforce',
  webDir: 'out',
  server: {
    url: 'https://ba-pwa.vercel.app',
    cleartext: false,
  },
};

export default config;
