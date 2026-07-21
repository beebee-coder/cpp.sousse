'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePlatform } from '@/components/PlatformProvider';

export type AppMode = 'web' | 'hybride' | 'locale';

export const LOCAL_ONLY_KEY = 'visionode-mode-local-only';

/**
 * Détermine le mode opérationnel de l'application :
 *  - web      : exécuté dans le navigateur (URL Vercel / cloud)            → isDesktop = false
 *  - hybride  : application installée localement (Tauri) en mode auto      → isDesktop = true + !localOnly + connecté
 *  - locale   : soit hors-ligne détecté, soit forçage manuel               → isDesktop = true + (localOnly OU déconnecté)
 */
function readLocalOnly(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(LOCAL_ONLY_KEY) === '1';
  } catch {
    return false;
  }
}

let initialConnectivityCheck: Promise<boolean> | null = null;

export function useAppMode() {
  const { isDesktop, isReady } = usePlatform();
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [localOnly, setLocalOnlyState] = useState<boolean>(() => readLocalOnly());

  useEffect(() => {
    setLocalOnlyState(readLocalOnly());

    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    if (!isDesktop || !isReady) return;

    let cancelled = false;

    async function checkInitialConnectivity() {
      if (!initialConnectivityCheck) {
        initialConnectivityCheck = (async () => {
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            const isOnline = await invoke<boolean>('check_network_connectivity');
            return isOnline;
          } catch {
            return typeof navigator !== 'undefined' ? navigator.onLine : false;
          }
        })();
      }

      const result = await initialConnectivityCheck;
      if (!cancelled) {
        setOnline(result);
      }
    }

    checkInitialConnectivity();
    return () => {
      cancelled = true;
    };
  }, [isDesktop, isReady]);

  const setLocalOnly = useCallback((value: boolean) => {
    setLocalOnlyState(value);
    try {
      localStorage.setItem(LOCAL_ONLY_KEY, value ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const resetLocalOnly = useCallback(() => {
    setLocalOnlyState(false);
    try {
      localStorage.removeItem(LOCAL_ONLY_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  let mode: AppMode;
  if (!isDesktop) mode = 'web';
  else if (localOnly) mode = 'locale';
  else mode = online ? 'hybride' : 'locale';

  const cloudSyncEnabled = online && !localOnly;

  return { mode, isDesktop, isReady, online, localOnly, setLocalOnly, resetLocalOnly, cloudSyncEnabled };
}
