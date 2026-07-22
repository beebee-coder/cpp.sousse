'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePlatform } from '@/components/PlatformProvider';

export type AppMode = 'web' | 'hybride' | 'locale';

export const LOCAL_ONLY_KEY = 'visionode-mode-local-only';

function broadcastLocalOnlyChange() {
  try {
    window.dispatchEvent(new Event('localOnlyChanged'));
  } catch {
    /* ignore */
  }
}

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
    const sync = () => setLocalOnlyState(readLocalOnly());
    const update = () => setOnline(navigator.onLine);

    sync();
    update();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_ONLY_KEY) sync();
    };

    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('localOnlyChanged', sync);

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('localOnlyChanged', sync);
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
            console.info(`[DIAG_MODE] tauri check_network_connectivity -> ${isOnline}`);
            return isOnline;
          } catch (e: any) {
            console.warn(`[DIAG_MODE] tauri check_network_connectivity failed: ${e?.message || e}`);
            const browserOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
            console.info(`[DIAG_MODE] navigator.onLine fallback -> ${browserOnline}`);
            return browserOnline;
          }
        })();
      }

      const result = await initialConnectivityCheck;
      if (!cancelled) {
        console.info(`[DIAG_MODE] initial hybrid connectivity state -> ${result}`);
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
    broadcastLocalOnlyChange();
  }, []);

  const resetLocalOnly = useCallback(() => {
    setLocalOnlyState(false);
    try {
      localStorage.removeItem(LOCAL_ONLY_KEY);
    } catch {
      /* ignore */
    }
    broadcastLocalOnlyChange();
  }, []);

  let mode: AppMode;
  if (!isDesktop) mode = 'web';
  else if (localOnly) mode = 'locale';
  else mode = online ? 'hybride' : 'locale';

  const cloudSyncEnabled = online && !localOnly;

  return { mode, isDesktop, isReady, online, localOnly, setLocalOnly, resetLocalOnly, cloudSyncEnabled };
}
