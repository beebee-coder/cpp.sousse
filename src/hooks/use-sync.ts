'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SyncState } from '@/lib/db/types';
import { syncEngine } from '@/lib/db/sync-engine';
import { useAppMode } from '@/hooks/use-app-mode';
import { useSession } from '@/components/SessionProvider';

const SYNC_TIMEOUT_MS = 30000;

export function useSync() {
  const { online, localOnly } = useAppMode();
  const { user } = useSession();
  const userId = user?.id ?? 'user-anonymous';

  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(false);

  const refreshState = useCallback(async () => {
    if (!isMounted.current) return;
    try {
      const state = await syncEngine.getSyncState(userId);
      state.localOnly = localOnly;
      setSyncState(state);
    } catch (e) {
      console.warn("Sync refresh failed");
    }
  }, [userId, localOnly]);

  const triggerSync = useCallback(async () => {
    if (isSyncingRef.current || !isMounted.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    setLastError(null);
    const timeout = setTimeout(() => {
      if (isMounted.current) {
        setIsSyncing(false);
        isSyncingRef.current = false;
        setLastError("Délai de synchronisation dépassé.");
      }
    }, SYNC_TIMEOUT_MS);
    try {
      if (localOnly || !online) {
        throw new Error("Liaison cloud désactivée (mode locale uniquement ou hors-ligne).");
      }
      await syncEngine.syncAll(userId, 'project-001', localOnly);
    } catch (e: any) {
      const msg = e.message || "Erreur de synchronisation";
      setLastError(msg);
    } finally {
      clearTimeout(timeout);
      isSyncingRef.current = false;
      if (isMounted.current) setIsSyncing(false);
      await refreshState();
    }
  }, [refreshState, userId, localOnly, online]);

  useEffect(() => {
    if (isSyncingRef.current) {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [localOnly, online]);

  useEffect(() => {
    isMounted.current = true;
    refreshState();

    // Auto-sync polling every 60s (silencieux hors-ligne / locale uniquement)
    timerRef.current = setInterval(() => {
      if (!localOnly && online) refreshState();
    }, 60000);

    return () => {
      isMounted.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refreshState, localOnly, online]);

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
