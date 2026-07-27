import { registerPlugin } from '@capacitor/core';

interface NativeSettingsPlugin {
  openLocationSettings(): Promise<void>;
}

const NativeSettings = registerPlugin<NativeSettingsPlugin>('NativeSettings');

export async function openLocationSettings() {
  try {
    await NativeSettings.openLocationSettings();
  } catch {
    // Not in native app — ignore
  }
}
