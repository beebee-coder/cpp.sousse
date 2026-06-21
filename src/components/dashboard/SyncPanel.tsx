'use client';

import { RefreshCw, Cloud, CloudOff, CheckCircle2, AlertCircle, UploadCloud, DownloadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSync } from '@/hooks/use-sync';

export function SyncPanel() {
  const { syncState, isSyncing, lastError, triggerSync, formatLastSync } = useSync();

  if (!syncState) return null;

  const isError = syncState.status === 'error' || !!lastError;

  return (
    <div className="border border-border bg-black/30 rounded-sm p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isError ? (
            <CloudOff className="w-3 h-3 text-destructive" />
          ) : (
            <Cloud className={cn("w-3 h-3", isSyncing ? "text-primary animate-pulse" : "text-secondary")} />
          )}
          <span className="text-[10px] font-bold uppercase tracking-widest font-headline">Liaison Cloud</span>
        </div>
        <span className={cn(
          "text-[9px] font-bold uppercase font-code px-1.5 py-0.5 rounded-sm",
          isError ? "bg-destructive/10 text-destructive" : "bg-secondary/10 text-secondary"
        )}>
          {syncState.status === 'syncing' ? 'TRAVAIL' : isError ? 'ERREUR' : 'NOMINAL'}
        </span>
      </div>

      {/* Sync Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-1.5 bg-background/50 border border-border rounded-sm flex items-center gap-1.5">
          <UploadCloud className="w-2.5 h-2.5 text-primary" />
          <span className="text-[10px] font-code font-bold text-primary">{syncState.pendingUploads} UP</span>
        </div>
        <div className="p-1.5 bg-background/50 border border-border rounded-sm flex items-center gap-1.5">
          <DownloadCloud className="w-2.5 h-2.5 text-secondary" />
          <span className="text-[10px] font-code font-bold text-secondary">{syncState.pendingDownloads} DL</span>
        </div>
      </div>

      {/* Last Sync Footer */}
      <div className="flex items-center justify-between text-[9px] font-code text-muted-foreground pt-1 border-t border-border/50">
        <span className="uppercase">Dernier Sync</span>
        <span className="text-foreground/70">{formatLastSync()}</span>
      </div>

      {/* Sync Button */}
      <button
        onClick={triggerSync}
        disabled={isSyncing}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-1.5 rounded-sm border transition-all active:scale-95",
          isSyncing 
            ? "border-primary/20 text-primary/40 cursor-not-allowed" 
            : "border-primary/40 text-primary hover:bg-primary/5 hover:border-primary"
        )}
      >
        <RefreshCw className={cn("w-3 h-3", isSyncing && "animate-spin")} />
        <span className="text-[10px] font-bold uppercase font-headline tracking-widest">
          {isSyncing ? "Sync en cours..." : "Lancer Sync"}
        </span>
      </button>

      {lastError && (
        <div className="flex items-start gap-1.5 p-2 bg-destructive/5 border border-destructive/20 rounded-sm">
          <AlertCircle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
          <p className="text-[9px] font-code text-destructive leading-tight uppercase">Erreur de liaison réseau.</p>
        </div>
      )}
    </div>
  );
}
