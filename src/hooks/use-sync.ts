'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SyncState } from '@/lib/db/types';
import { syncEngine } from '@/lib/db/sync-engine';

const DEFAULT_PROJECT = 'project-001';
const USER_ID = 'user-admin-001';

export function useSync() {
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const refreshState = useCallback(async () => {
    const state = await syncEngine.getSyncState(USER_ID);
    setSyncState(state);
  }, []);

  const triggerSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setLastError(null);
    try {
      await syncEngine.syncAll(USER_ID, DEFAULT_PROJECT);
      await refreshState();
    } catch (e: any) {
      setLastError(e.message);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshState]);

  useEffect(() => {
    refreshState();
    // Auto-sync polling every 30s
    timerRef.current = setInterval(() => {
      refreshState();
    }, 30000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refreshState]);

  const formatLastSync = () => {
    if (!syncState || syncState.lastSync.getTime() === 0) return 'JAMAIS';
    return syncState.lastSync.toLocaleTimeString();
  };

  return {
    syncState,
    isSyncing,
    lastError,
    triggerSync,
    formatLastSync
  };
}
