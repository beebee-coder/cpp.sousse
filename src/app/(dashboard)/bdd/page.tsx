"use client";

import { useState, useEffect, useCallback } from 'react';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { 
  Folder, 
  File, 
  ChevronRight, 
  ChevronDown, 
  Database, 
  RefreshCw,
  Server,
  CloudLightning,
  ShieldAlert,
  Zap,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

interface FSNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FSNode[];
  isOpen?: boolean;
}

export default function BDDPage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<'chroma' | 'web'>('chroma');
  const [tree, setTree] = useState<FSNode[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string>('DÉTECTION...');

  // 1. Sync Physique (ChromaDB)
  const syncChromaState = useCallback(async (isAuto = false) => {
    setIsSyncing(true);
    try {
      const res = await apiClient.get<any>('/api/vector/collections');
      if (res && res.success) {
        setActiveProvider(res.provider || 'CHROMA');
        const chromaNodes = res.collections.map((c: any) => ({
          id: `chroma-${c.name}`,
          name: c.name,
          type: 'folder' as const,
          children: []
        }));
        setTree([{ id: 'root', name: 'COLLECTIONS_LOCALES', type: 'folder', isOpen: true, children: chromaNodes }]);
        if (!isAuto) toast({ title: "Nœud Détecté", description: `Moteur ${res.provider} synchronisé.` });
      } else {
        throw new Error();
      }
    } catch (e) {
      setActiveProvider('HORS_LIGNE');
    } finally {
      setIsSyncing(false);
    }
  }, [toast]);

  // 2. Sync Web + Ingestion Chroma + Purge Immédiate
  const syncWebAndPurge = async () => {
    setIsSyncing(true);
    setIsPurging(true);
    const timestamp = new Date().toLocaleTimeString();
    
    try {
      console.log(`📡 [${timestamp}] [SYNC_START] Descente du tampon Web...`);
      
      const res = await apiClient.post<any>('/api/sync/download', {
        userId: 'admin',
        projectId: 'project-001',
        lastSync: new Date(0).toISOString()
      });

      if (res.items && res.items.length > 0) {
        // A. Ingestion dans ChromaDB (Texte & Metadata)
        const textDocs = res.items.filter((i: any) => i.type === 'document');
        if (textDocs.length > 0) {
          await apiClient.post('/api/vector/ingest', {
            items: textDocs.map((i: any) => {
              const data = JSON.parse(i.content);
              return { question: data.label, answer: data.details };
            }),
            metadata: { collection: 'industrial_manuals', source: 'sync_web' }
          });
        }

        // B. Purge Immédiate de Neon
        const ids = res.items.map((i: any) => i.id);
        await apiClient.post('/api/sync/cleanup', { ids, projectId: 'project-001' });

        toast({ title: "Cycle Terminé", description: `${ids.length} assets transférés vers Chroma et purgés du Cloud.` });
      } else {
        toast({ title: "Tampon Vide", description: "Aucun asset JSON/Média en attente." });
      }
      
      setTree([{ id: 'root', name: 'WEB_BUFFER_VIDE', type: 'folder', isOpen: true, children: [] }]);
    } catch (e) {
      toast({ title: "Échec Cycle", description: "Rupture de liaison pendant la purge.", variant: "destructive" });
    } finally {
      setIsSyncing(false);
      setIsPurging(false);
    }
  };

  useEffect(() => {
    if (mode === 'chroma') syncChromaState(true);
    else setTree([{ id: 'root', name: 'WEB_BUFFER', type: 'folder', isOpen: true, children: [] }]);
  }, [mode, syncChromaState]);

  const toggleFolder = (id: string) => {
    const update = (nodes: FSNode[]): FSNode[] => nodes.map(n => n.id === id ? { ...n, isOpen: !n.isOpen } : (n.children ? { ...n, children: update(n.children) } : n));
    setTree(update(tree));
  };

  const renderTree = (nodes: FSNode[], depth = 0) => {
    return nodes.map(node => (
      <div key={node.id} className="select-none">
        <div className="flex items-center gap-2 py-1 px-2 hover:bg-primary/5 cursor-pointer rounded-sm" style={{ paddingLeft: `${depth * 1 + 0.5}rem` }}>
          {node.type === 'folder' ? (
            <button onClick={() => toggleFolder(node.id)} className="p-0.5 text-muted-foreground">
              {node.isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : <div className="w-4.5" />}
          {node.type === 'folder' ? <Folder className="w-4 h-4 text-primary" /> : <File className="w-4 h-4 text-secondary" />}
          <span className="text-[11px] font-code uppercase truncate py-0.5">{node.name}</span>
        </div>
        {node.isOpen && node.children && <div className="border-l border-border/50 ml-3.5">{renderTree(node.children, depth + 1)}</div>}
      </div>
    ));
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">BDD Hybride</span>
            </div>
          </div>
          <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
            <button onClick={() => setMode('chroma')} className={cn("px-3 py-1 text-[10px] font-code uppercase rounded-sm", mode === 'chroma' ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>Vecteur</button>
            <button onClick={() => setMode('web')} className={cn("px-3 py-1 text-[10px] font-code uppercase rounded-sm", mode === 'web' ? "bg-secondary text-secondary-foreground" : "text-muted-foreground")}>Web</button>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-6 overflow-hidden flex flex-col lg:flex-row gap-6">
          <Card className="w-full lg:w-80 flex flex-col bg-black/40 border-border overflow-hidden shrink-0">
            <div className="p-3 border-b border-border bg-card/50 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Explorateur</span>
              <Badge variant="outline" className="text-[8px] uppercase">{mode === 'web' ? 'Tampon Cloud' : 'Index Local'}</Badge>
            </div>
            <div className="flex-1 overflow-auto terminal-scroll p-2">{renderTree(tree)}</div>
          </Card>

          <Card className="flex-1 bg-card/30 border-border p-8 flex flex-col items-center justify-center text-center">
            {mode === 'chroma' ? (
              <>
                <Server className={cn("w-12 h-12 mb-4", isSyncing ? "text-primary animate-spin" : "text-muted-foreground/20")} />
                <h3 className="font-headline font-bold text-lg uppercase tracking-widest mb-2">Moteur de Recherche Local</h3>
                <p className="text-xs text-muted-foreground font-code max-w-sm mb-8">Liaison directe avec ChromaDB. Les données sont indexées sémantiquement après synchronisation.</p>
                <div className="p-4 border border-border bg-black/20 rounded-sm w-full max-w-sm">
                  <p className="text-[10px] font-bold text-primary uppercase mb-1">Nœud Actif</p>
                  <p className="text-xs font-code text-muted-foreground truncate">{activeProvider}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => syncChromaState()} disabled={isSyncing} className="mt-6 text-[10px] uppercase font-code">
                  <RefreshCw className={cn("w-3 h-3 mr-2", isSyncing && "animate-spin")} /> Rafraîchir
                </Button>
              </>
            ) : (
              <>
                <CloudLightning className={cn("w-12 h-12 mb-4", isSyncing ? "text-secondary animate-pulse" : "text-muted-foreground/20")} />
                <h3 className="font-headline font-bold text-lg uppercase tracking-widest mb-2">Cycle de Purge Cloud</h3>
                <p className="text-xs text-muted-foreground font-code max-w-sm mb-8">Les JSON et Médias capturés sur le terrain transitent ici avant d'être sécurisés en local.</p>
                <div className="flex flex-col gap-4 w-full max-w-sm">
                  <Card className="p-4 border-secondary/20 bg-secondary/5 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-3.5 h-3.5 text-secondary" />
                      <p className="text-[10px] font-bold text-secondary uppercase">Action Atomique</p>
                    </div>
                    <p className="text-[10px] font-code text-muted-foreground">Transfert des fichiers JSON vers ChromaDB + Nettoyage total de Neon Postgres.</p>
                  </Card>
                  <Button onClick={syncWebAndPurge} disabled={isSyncing} className="bg-secondary text-secondary-foreground h-10 text-[10px] font-code uppercase font-bold">
                    {isPurging ? <ShieldAlert className="w-3.5 h-3.5 mr-2 animate-bounce" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
                    {isPurging ? "Purge en cours..." : "Sync & Purge Neon"}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
