'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePlatform } from '@/components/PlatformProvider';

export type AppMode = 'web' | 'hybride' | 'locale';

const LOCAL_ONLY_KEY = 'visionode-mode-local-only';

/**
 * Détermine le mode opérationnel de l'application :
 *  - web      : exécuté dans le navigateur (URL Vercel / cloud)            → isDesktop = false
 *  - hybride  : application installée localement (Tauri) connectée au cloud → isDesktop = true + en ligne
 *  - locale   : application locale SANS connexion, ou l'utilisateur force le mode local uniquement
 */
export function useAppMode() {
  const { isDesktop, isReady } = usePlatform();
  const [online, setOnline] = useState(true);
  const [localOnly, setLocalOnlyState] = useState(false);

  useEffect(() => {
    try {
      setLocalOnlyState(localStorage.getItem(LOCAL_ONLY_KEY) === '1');
    } catch {
      /* localStorage indisponible */
    }

    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const setLocalOnly = useCallback((value: boolean) => {
    setLocalOnlyState(value);
    try {
      localStorage.setItem(LOCAL_ONLY_KEY, value ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  let mode: AppMode;
  if (localOnly) mode = 'locale';
  else if (!isDesktop) mode = 'web';
  else mode = 'hybride'; // Toujours hybride si Tauri détecté, même offline

  return { mode, isDesktop, isReady, online, localOnly, setLocalOnly };
}
