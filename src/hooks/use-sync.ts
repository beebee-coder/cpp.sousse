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
  const isMounted = useRef(false);

  const refreshState = useCallback(async () => {
    if (!isMounted.current) return;
    try {
      const state = await syncEngine.getSyncState(USER_ID);
      setSyncState(state);
    } catch (e) {
      console.warn("Sync refresh failed");
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (isSyncing || !isMounted.current) return;
    setIsSyncing(true);
    setLastError(null);
    try {
      await syncEngine.syncAll(USER_ID, DEFAULT_PROJECT);
      await refreshState();
    } catch (e: any) {
      setLastError(e.message || "Erreur de synchronisation");
    } finally {
      if (isMounted.current) setIsSyncing(false);
    }
  }, [isSyncing, refreshState]);

  useEffect(() => {
    isMounted.current = true;
    refreshState();
    
    // Auto-sync polling every 60s
    timerRef.current = setInterval(() => {
      refreshState();
    }, 60000);

    return () => {
      isMounted.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refreshState]);

  const formatLastSync = () => {
    if (!syncState || !syncState.lastSync || syncState.lastSync.getTime() === 0) return 'JAMAIS';
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
