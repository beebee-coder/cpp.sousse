"use client";

/**
 * @fileOverview Panneau de synchronisation BDD Web <-> BDD Locale.
 * Visible uniquement en mode Desktop (Tauri). Affiché dans le Dashboard.
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Clock, CloudDownload, Upload, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppMode } from '@/hooks/use-app-mode';

interface SyncState {
  lastSync: string | null;
  status: 'idle' | 'syncing' | 'error' | 'success';
  pendingUploads: number;
  downloadedCount: number;
  errorMessage?: string;
}

interface SyncPanelProps {
  userId: string;
  className?: string;
}

export function SyncPanel({ userId, className }: SyncPanelProps) {
  const { online, localOnly } = useAppMode();
  const [syncState, setSyncState] = useState<SyncState>({
    lastSync: null,
    status: 'idle',
    pendingUploads: 0,
    downloadedCount: 0,
  });
  const [isAnimating, setIsAnimating] = useState(false);

  const cloudDisabled = localOnly || !online;

  // Charger l'état de sync depuis localStorage au montage
  useEffect(() => {
    const raw = localStorage.getItem(`visionode_sync_state_${userId}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setSyncState((prev) => ({
          ...prev,
          lastSync: parsed.lastSync ?? null,
          status: parsed.status === 'error' ? 'error' : 'idle',
        }));
      } catch {}
    }
  }, [userId]);

  const triggerSync = useCallback(async () => {
    if (syncState.status === 'syncing') return;
    if (localOnly) {
      setSyncState((prev) => ({ ...prev, status: 'error', errorMessage: 'Liaison cloud désactivée (mode locale uniquement).' }));
      return;
    }
    if (!online) {
      setSyncState((prev) => ({ ...prev, status: 'error', errorMessage: 'Aucune connexion détectée.' }));
      return;
    }

    setIsAnimating(true);
    setSyncState((prev) => ({ ...prev, status: 'syncing', errorMessage: undefined }));

    try {
      // 1. Download depuis Neon → ChromaDB local
      const downloadRes = await fetch('/api/sync/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          projectId: 'global',
          lastSync: syncState.lastSync ?? new Date(0).toISOString(),
          scope: 'all',
        }),
      });

      const downloadData = await downloadRes.json();
      const downloadedCount = downloadData.count ?? 0;

      // 2. Sauvegarder l'état
      const newState = {
        lastSync: new Date().toISOString(),
        status: 'synced',
        pendingUploads: 0,
        downloadedCount,
      };
      localStorage.setItem(`visionode_sync_state_${userId}`, JSON.stringify(newState));

      setSyncState({
        lastSync: newState.lastSync,
        status: 'success',
        pendingUploads: 0,
        downloadedCount,
      });

      setTimeout(() => setSyncState((prev) => ({ ...prev, status: 'idle' })), 3000);
    } catch (err: any) {
      setSyncState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: err.message,
      }));
    } finally {
      setIsAnimating(false);
    }
  }, [userId, syncState.lastSync, syncState.status]);

  const formatLastSync = (isoDate: string | null) => {
    if (!isoDate) return 'Jamais synchronisé';
    const date = new Date(isoDate);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return `Il y a ${diff}s`;
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const statusConfig = {
    idle: { color: 'text-muted-foreground', bg: 'bg-muted/20', icon: Clock, label: 'En attente' },
    syncing: { color: 'text-primary', bg: 'bg-primary/10', icon: RefreshCw, label: 'Synchronisation...' },
    success: { color: 'text-secondary', bg: 'bg-secondary/10', icon: CheckCircle2, label: 'Synchronisé' },
    error: { color: 'text-destructive', bg: 'bg-destructive/10', icon: AlertCircle, label: 'Erreur' },
  };

  const { color, bg, icon: StatusIcon, label } = statusConfig[syncState.status];

  return (
    <div className={cn(
      'border border-border rounded-lg p-4 bg-card/30 backdrop-blur-sm space-y-4',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-widest font-headline">
            Sync BDD Locale
          </h3>
        </div>
        <div className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase', bg, color)}>
          <StatusIcon className={cn('w-3 h-3', syncState.status === 'syncing' && 'animate-spin')} />
          {label}
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-black/20 rounded p-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <CloudDownload className="w-3 h-3 text-primary" />
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest">Téléchargés</span>
          </div>
          <p className="text-sm font-bold text-primary">{syncState.downloadedCount}</p>
        </div>
        <div className="bg-black/20 rounded p-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Upload className="w-3 h-3 text-secondary" />
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest">En attente</span>
          </div>
          <p className="text-sm font-bold text-secondary">{syncState.pendingUploads}</p>
        </div>
      </div>

      {/* Dernière sync */}
      <div className="flex items-center justify-between text-[10px] font-code text-muted-foreground">
        <span>Dernière sync :</span>
        <span className="text-foreground">{formatLastSync(syncState.lastSync)}</span>
      </div>

      {/* Message d'erreur */}
      {syncState.status === 'error' && syncState.errorMessage && (
        <div className="bg-destructive/10 border border-destructive/30 rounded p-2 text-[10px] text-destructive font-code">
          {syncState.errorMessage}
        </div>
      )}

      {/* Succès */}
      {syncState.status === 'success' && (
        <div className="bg-secondary/10 border border-secondary/30 rounded p-2 text-[10px] text-secondary font-code">
          ✅ {syncState.downloadedCount} connaissances injectées dans ChromaDB local
        </div>
      )}

      {/* Bouton de sync */}
      <button
        onClick={triggerSync}
        disabled={syncState.status === 'syncing' || cloudDisabled}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-2 px-4 rounded text-xs font-bold uppercase tracking-widest transition-all duration-200',
          'border border-primary/30 bg-primary/10 text-primary',
          'hover:bg-primary/20 hover:border-primary/60',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        <RefreshCw className={cn('w-3.5 h-3.5', isAnimating && 'animate-spin')} />
        {syncState.status === 'syncing' ? 'Synchronisation...' : 'Synchroniser maintenant'}
      </button>

      {/* Légende */}
      <p className="text-[9px] text-muted-foreground font-code text-center leading-relaxed">
        Injecte les Q/R et procédures web dans ChromaDB local<br />
        pour utilisation IA hors-ligne
      </p>
    </div>
  );
}
