import { useEffect, useState } from 'react';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Botón «Instalar app»: el navegador avisa cuando VillaMusic se puede instalar. */
export function useInstall() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    const onInstalled = () => setEvt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  // iPhone/iPad no avisan: la instalación es manual (Compartir → Añadir a pantalla de inicio).
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  return {
    canInstall: !!evt || (ios && !standalone),
    needsHint: !evt && ios && !standalone,
    install: async () => {
      if (!evt) return;
      await evt.prompt();
      setEvt(null);
    },
  };
}

/** Registra el service worker solo en la versión publicada. */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
