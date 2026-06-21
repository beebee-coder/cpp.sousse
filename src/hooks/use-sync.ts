'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SyncState } from '@/lib/db/types';
import { syncEngine } from '@/lib/db/sync-engine';
import { localAuth } from '@/lib/auth/local-auth';
import { localConfig } from '@/lib/config/local-config';

const DEFAULT_PROJECT_ID = 'project-visionode-001';

export function useSync() {
  const [syncState, setSyncState] = useState<SyncState>({
    userId: 'loading...',
    deviceId: 'dev-station-001',
    lastSync: new Date(0),
    pendingUploads: 0,
    pendingDownloads: 0,
    status: 'idle',
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load initial sync state
  useEffect(() => {
    const session = localAuth.getCurrentSession();
    const userId = session?.id || 'usr-local-001';

    syncEngine.getSyncState(userId).then(state => {
      setSyncState(state);
    });
  }, []);

  // Auto-sync polling
  useEffect(() => {
    const session = localAuth.getCurrentSession();
    const userId = session?.id || 'usr-local-001';

    intervalRef.current = setInterval(async () => {
      const state = await syncEngine.getSyncState(userId);
      setSyncState({ ...state });
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const triggerSync = useCallback(async () => {
    if (isSyncing) return;
    const session = localAuth.getCurrentSession();
    const userId = session?.id || 'usr-local-001';

    setIsSyncing(true);
    setLastError(null);
    try {
      await syncEngine.syncAll(userId, DEFAULT_PROJECT_ID);
      const updated = await syncEngine.getSyncState(userId);
      setSyncState({ ...updated });
    } catch (e: any) {
      setLastError(e.message || 'Erreur de synchronisation');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  const formatLastSync = (): string => {
    if (syncState.lastSync.getTime() === 0) return 'Jamais synchronisé';
    const diff = Date.now() - syncState.lastSync.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'À l\'instant';
    if (mins < 60) return `Il y a ${mins} min`;
    const hrs = Math.floor(mins / 60);
    return `Il y a ${hrs}h`;
  };

  return {
    syncState,
    isSyncing,
    lastError,
    triggerSync,
    formatLastSync,
  };
}
