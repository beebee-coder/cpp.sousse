'use client';

import { RefreshCw, Cloud, CloudOff, CheckCircle2, AlertCircle, UploadCloud, DownloadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSync } from '@/hooks/use-sync';

export function SyncPanel() {
  const { syncState, isSyncing, lastError, triggerSync, formatLastSync } = useSync();

  const statusColor = {
    idle: 'text-secondary',
    syncing: 'text-primary',
    error: 'text-destructive',
  }[syncState.status];

  const statusLabel = {
    idle: 'NOMINAL',
    syncing: 'SYNC EN COURS',
    error: 'ERREUR',
  }[syncState.status];

  return (
    <div className="border border-border bg-black/30 rounded-sm p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {syncState.status === 'error'
            ? <CloudOff className="w-3 h-3 text-destructive" />
            : <Cloud className={cn("w-3 h-3", isSyncing ? "text-primary animate-pulse" : "text-secondary")} />
          }
          <span className="text-[10px] font-bold uppercase tracking-widest font-headline">Synchronisation</span>
        </div>
        <span className={cn("text-[9px] font-bold uppercase font-code px-1.5 py-0.5 rounded-sm", statusColor,
          syncState.status === 'idle' ? 'bg-secondary/10' : syncState.status === 'syncing' ? 'bg-primary/10' : 'bg-destructive/10'
        )}>
          {statusLabel}
        </span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex items-center gap-1.5 bg-background/50 border border-border rounded-sm p-1.5">
          <UploadCloud className="w-2.5 h-2.5 text-primary shrink-0" />
          <div>
            <p className="text-[8px] text-muted-foreground uppercase font-code">En attente</p>
            <p className="text-[11px] font-bold text-primary font-code">{syncState.pendingUploads} Upload</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-background/50 border border-border rounded-sm p-1.5">
          <DownloadCloud className="w-2.5 h-2.5 text-secondary shrink-0" />
          <div>
            <p className="text-[8px] text-muted-foreground uppercase font-code">Distants</p>
            <p className="text-[11px] font-bold text-secondary font-code">{syncState.pendingDownloads} Pull</p>
          </div>
        </div>
      </div>

      {/* Last Sync */}
      <div className="flex items-center justify-between text-[9px] font-code text-muted-foreground">
        <span className="uppercase">Dernier sync</span>
        <span className="text-foreground/70">{formatLastSync()}</span>
      </div>

      {/* Error message */}
      {lastError && (
        <div className="flex items-start gap-1 text-[9px] font-code text-destructive bg-destructive/5 border border-destructive/20 rounded-sm p-1.5">
          <AlertCircle className="w-2.5 h-2.5 shrink-0 mt-0.5" />
          <span className="break-all">{lastError}</span>
        </div>
      )}

      {/* Sync button */}
      <button
        onClick={triggerSync}
        disabled={isSyncing}
        className={cn(
          "w-full flex items-center justify-center gap-1.5 py-1.5 rounded-sm border text-[10px] font-bold uppercase font-headline tracking-widest transition-all",
          isSyncing
            ? "border-primary/30 text-primary/50 cursor-not-allowed"
            : "border-primary/40 text-primary hover:bg-primary/10 hover:border-primary active:scale-95"
        )}
      >
        <RefreshCw className={cn("w-3 h-3", isSyncing && "animate-spin")} />
        {isSyncing ? 'Synchronisation...' : 'Lancer Sync'}
      </button>
    </div>
  );
}
