'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePlatform } from '@/components/PlatformProvider';

export type AppMode = 'web' | 'hybride' | 'locale';

export const LOCAL_ONLY_KEY = 'visionode-mode-local-only';

/**
 * Détermine le mode opérationnel de l'application :
 *  - web      : exécuté dans le navigateur (URL Vercel / cloud)            → isDesktop = false
 *  - hybride  : application installée localement (Tauri) en mode auto      → isDesktop = true + !localOnly
 *  - locale   : application locale SANS connexion, ou l'utilisateur force le mode local uniquement
 */
function readLocalOnly(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(LOCAL_ONLY_KEY) === '1';
  } catch {
    return false;
  }
}

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
  if (localOnly && isDesktop) mode = 'locale';
  else if (!isDesktop) mode = 'web';
  else mode = 'hybride';

  /**
   * La liaison cloud est possible dès qu'on est en ligne et non forcé en local
   * — y compris en mode web (navigateur), où le sync-engine utilise les routes
   * /api/local-db + /api/registry (branches !isDesktop). Le poste hybride
   * (Tauri) garde bien sûr aussi la liaison activée.
   */
  const cloudSyncEnabled = online && !localOnly;

  return { mode, isDesktop, isReady, online, localOnly, setLocalOnly, resetLocalOnly, cloudSyncEnabled };
}
