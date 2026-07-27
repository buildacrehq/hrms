'use client';
import { useEffect } from 'react';

// Handles Android back button inside the Capacitor WebView.
// WebView.canGoBack() is unreliable for SPA (pushState) navigation, so we
// use window.location.pathname to decide: if on /home → minimize, else go back.
export function CapacitorBackHandler() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!(window as any).Capacitor) return;

    let listenerHandle: { remove: () => void } | null = null;

    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        listenerHandle = await App.addListener('backButton', () => {
          const path = window.location.pathname;
          if (path === '/home' || path === '/' || path === '') {
            App.minimizeApp();
          } else {
            window.history.back();
          }
        });
      } catch {
        // not in a Capacitor context
      }
    })();

    return () => { listenerHandle?.remove(); };
  }, []);

  return null;
}
