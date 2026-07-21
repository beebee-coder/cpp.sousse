'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { RefreshCw, Cloud, CloudOff, Wifi, WifiOff, CheckCircle2, AlertCircle, UploadCloud, DownloadCloud, ArrowDownUp, Database, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSync } from '@/hooks/use-sync';
import { useAppMode } from '@/hooks/use-app-mode';
import { useBddSelection } from '@/lib/bdd-selection-store';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

export function SyncPanel() {
  const { syncState, isSyncing, lastError, triggerSync, formatLastSync } = useSync();
  const { mode, online, localOnly } = useAppMode();
  const selection = useBddSelection();
  const { toast } = useToast();

  const isError = syncState?.status === 'error' || !!lastError;

  const cloudDisabled = localOnly || !online;

  const connectionLabel = online ? 'EN LIGNE' : 'HORS-LIGNE';

  const syncLabel = cloudDisabled
    ? (localOnly ? 'LOCALE' : 'OFFLINE')
    : (syncState?.status === 'syncing' ? 'TRAVAIL' : isError ? 'ERREUR' : 'NOMINAL');

  const showSyncButton = mode === 'hybride';
  const syncBlocked = cloudDisabled || isSyncing;

  const showVectorize = (mode === 'hybride' || mode === 'locale') && !!selection.relPath;
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState<{ done: number; total: number } | null>(null);
  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!syncState) return;
    const prev = prevStatusRef.current;
    const current = syncState.status;
    if (prev === 'syncing' && current === 'idle') {
      toast({ title: 'Synchronisation terminée', description: `Dernière sync : ${formatLastSync()}` });
    } else if (prev === 'syncing' && current === 'error') {
      toast({ title: 'Échec de la synchronisation', description: lastError || 'Erreur inconnue', variant: 'destructive' });
    }
    prevStatusRef.current = current;
  }, [syncState, lastError, toast, formatLastSync]);

  const vectorizeSelection = useCallback(async () => {
    if (!selection.relPath || isIndexing) return;
    setIsIndexing(true);
    setIndexProgress(null);
    const label = selection.relPath.split('/').pop() || selection.relPath;
    toast({ title: '⏳ Vectorisation démarrée', description: `${label} → Vecteurs ChromaDB…` });
    try {
      const { indexLocalDBFile, indexLocalDBFolderWithProgress } = await import('@/lib/local-indexer');
      if (selection.type === 'folder') {
        const res = await indexLocalDBFolderWithProgress(selection.relPath, (p) => setIndexProgress(p));
        if (res.success) {
          toast({ title: '✅ Dossier vectorisé', description: `${res.indexed ?? 0} fichier(s) indexé(s) vers ChromaDB.` });
        } else {
          throw new Error(res.error || 'Échec de l’indexation du dossier');
        }
      } else {
        const res = await indexLocalDBFile(selection.relPath);
        if (res.success) {
          toast({ title: '✅ Fichier vectorisé', description: `${selection.relPath} → ChromaDB (${res.chunkCount ?? 0} chunks).` });
        } else {
          throw new Error(res.error || res.message || 'Échec de l’indexation');
        }
      }
    } catch (e: any) {
      toast({ title: '❌ Échec de la vectorisation', description: e.message, variant: 'destructive' });
    } finally {
      setIsIndexing(false);
      setIndexProgress(null);
    }
  }, [selection.relPath, selection.type, isIndexing, toast]);

  if (!syncState) return null;

  return (
    <div className="border border-border bg-black/30 rounded-sm p-3 space-y-3">
      {/* Header : Liaison Cloud → état de connexion */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {online ? (
            <Wifi className={cn("w-3 h-3", isSyncing ? "text-primary animate-pulse" : "text-secondary")} />
          ) : (
            <WifiOff className="w-3 h-3 text-muted-foreground" />
          )}
          <span className="text-[10px] font-bold uppercase tracking-widest font-headline">Connexion</span>
        </div>
        <span className={cn(
          "text-[9px] font-bold uppercase font-code px-1.5 py-0.5 rounded-sm",
          online
            ? "bg-secondary/10 text-secondary"
            : "bg-muted/10 text-muted-foreground"
        )}>
          {connectionLabel}
        </span>
      </div>

      {/* Sous-en-tête : mode + état de synchronisation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {cloudDisabled ? (
            <CloudOff className="w-3 h-3 text-muted-foreground" />
          ) : isError ? (
            <CloudOff className="w-3 h-3 text-destructive" />
          ) : (
            <Cloud className={cn("w-3 h-3", isSyncing ? "text-primary animate-pulse" : "text-secondary")} />
          )}
          <span className="text-[10px] font-bold uppercase tracking-widest font-headline">Sync · {mode}</span>
        </div>
        <span className={cn(
          "text-[9px] font-bold uppercase font-code px-1.5 py-0.5 rounded-sm",
          isError
            ? "bg-destructive/10 text-destructive"
            : cloudDisabled
              ? "bg-muted/10 text-muted-foreground"
              : "bg-secondary/10 text-secondary"
        )}>
          {syncLabel}
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
        <span className="text-foreground/70">{cloudDisabled ? 'SUSPENDU' : formatLastSync()}</span>
      </div>

      {/* Boutons de synchronisation dynamiques */}
      {showSyncButton && (
        <button
          onClick={triggerSync}
          disabled={syncBlocked}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-1.5 rounded-sm border transition-all active:scale-95",
            isSyncing
              ? "border-primary/20 text-primary/40 cursor-not-allowed"
              : cloudDisabled
                ? "border-muted/20 text-muted-foreground/40 cursor-not-allowed"
                : "border-primary/40 text-primary hover:bg-primary/5 hover:border-primary"
          )}
        >
          <ArrowDownUp className={cn("w-3 h-3", isSyncing && "animate-spin")} />
          <span className="text-[10px] font-bold uppercase font-headline tracking-widest">
            {isSyncing ? "Sync en cours..." : cloudDisabled ? "Sync suspendu" : "Synchroniser"}
          </span>
        </button>
      )}

      {showVectorize && (
        <button
          onClick={vectorizeSelection}
          disabled={isIndexing || cloudDisabled}
          title={selection.relPath ?? undefined}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-1.5 rounded-sm border transition-all active:scale-95",
            isIndexing
              ? "border-accent/20 text-accent/40 cursor-not-allowed"
              : "border-accent/40 text-accent hover:bg-accent/5 hover:border-accent"
          )}
        >
          {isIndexing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Database className="w-3 h-3" />
          )}
          <span className="text-[10px] font-bold uppercase font-headline tracking-widest truncate">
            {isIndexing ? 'Vectorisation...' : `Vectoriser : ${selection.relPath?.split('/').pop()}`}
          </span>
        </button>
      )}

      {/* Ligne de progression d'indexation (dossier) */}
      {showVectorize && isIndexing && indexProgress && (
        <div className="space-y-1">
          <Progress value={indexProgress.total ? (indexProgress.done / indexProgress.total) * 100 : 0} className="h-1.5 bg-background/60" />
          <div className="flex items-center justify-between text-[9px] font-code text-accent/80 uppercase">
            <span className="truncate">{selection.relPath?.split('/').pop()}</span>
            <span className="shrink-0 ml-2">{indexProgress.done}/{indexProgress.total}</span>
          </div>
        </div>
      )}

      {lastError && (
        <div className="flex items-start gap-1.5 p-2 bg-destructive/5 border border-destructive/20 rounded-sm">
          <AlertCircle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
          <p className="text-[9px] font-code text-destructive leading-tight uppercase">{lastError}</p>
        </div>
      )}
    </div>
  );
}
