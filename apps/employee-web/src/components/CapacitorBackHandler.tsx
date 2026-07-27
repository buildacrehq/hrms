'use client';
import { useEffect } from 'react';

export function CapacitorBackHandler() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!(window as any).Capacitor) return;

    let cleanup: (() => void) | undefined;

    import('@capacitor/app').then(({ App }) => {
      const handle = App.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          App.minimizeApp();
        }
      });
      cleanup = () => { handle.then(h => h.remove()); };
    });

    return () => { cleanup?.(); };
  }, []);

  return null;
}
