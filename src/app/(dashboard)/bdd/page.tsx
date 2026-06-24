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
  ArrowRight,
  HardDrive
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
  type: 'file' | 'folder' | 'collection';
  count?: number;
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

  // 1. Sync Physique (ChromaDB Local)
  const syncChromaState = useCallback(async (isAuto = false) => {
    setIsSyncing(true);
    try {
      const res = await apiClient.get<any>('/api/vector/collections');
      if (res && res.success) {
        setActiveProvider(res.provider || 'CHROMA');
        const chromaNodes = res.collections.map((c: any) => ({
          id: `chroma-${c.name}`,
          name: `${c.name} (${c.count || 0} docs)`,
          type: 'collection' as const,
          count: c.count
        }));
        
        setTree([
          { 
            id: 'root', 
            name: 'INDEX_PHYSIQUE_CHROMA', 
            type: 'folder', 
            isOpen: true, 
            children: chromaNodes 
          }
        ]);
        
        if (!isAuto) toast({ title: "Moteur Détecté", description: `Liaison établie avec ${res.provider}.` });
      } else {
        throw new Error();
      }
    } catch (e) {
      setActiveProvider('ERREUR_LIAISON');
      setTree([{ id: 'error', name: 'MOTEUR_INDISPONIBLE', type: 'folder' }]);
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
        syncChromaState(true);
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
    else setTree([{ id: 'root', name: 'REGISTRE_CLOUD', type: 'folder', isOpen: true, children: [] }]);
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
          
          {node.type === 'folder' ? (
            <Folder className="w-4 h-4 text-primary" />
          ) : node.type === 'collection' ? (
            <Database className="w-4 h-4 text-secondary" />
          ) : (
            <File className="w-4 h-4 text-muted-foreground" />
          )}
          
          <span className="text-[11px] font-code uppercase truncate py-0.5">
            {node.name}
          </span>
        </div>
        {node.isOpen && node.children && (
          <div className="border-l border-border/50 ml-3.5">
            {renderTree(node.children, depth + 1)}
          </div>
        )}
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
              <HardDrive className="w-4 h-4 text-primary" />
              <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Explorateur de Données Physique</span>
            </div>
          </div>
          <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
            <button onClick={() => setMode('chroma')} className={cn("px-3 py-1 text-[10px] font-code uppercase rounded-sm", mode === 'chroma' ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground")}>Index Local</button>
            <button onClick={() => setMode('web')} className={cn("px-3 py-1 text-[10px] font-code uppercase rounded-sm", mode === 'web' ? "bg-secondary text-secondary-foreground font-bold" : "text-muted-foreground")}>Registre Web</button>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-6 overflow-hidden flex flex-col lg:flex-row gap-6">
          <Card className="w-full lg:w-96 flex flex-col bg-black/40 border-border overflow-hidden shrink-0 shadow-2xl">
            <div className="p-3 border-b border-border bg-card/50 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Arborescence Physique</span>
              <Badge variant="outline" className="text-[8px] uppercase">{mode === 'web' ? 'Temporaire' : 'Persistant'}</Badge>
            </div>
            <div className="flex-1 overflow-auto terminal-scroll p-2">
              {renderTree(tree)}
            </div>
            <div className="p-3 border-t border-border bg-black/20">
              <p className="text-[9px] font-code text-muted-foreground uppercase leading-tight">
                Emplacement : {mode === 'chroma' ? '/data/chromadb' : 'registry/cloud_registry.json'}
              </p>
            </div>
          </Card>

          <Card className="flex-1 bg-card/30 border-border p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
            {/* Scanlines Effect */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] z-0 bg-[length:100%_4px,3px_100%] opacity-20" />
            
            <div className="relative z-10 w-full max-w-lg">
              {mode === 'chroma' ? (
                <>
                  <HardDrive className={cn("w-16 h-16 mx-auto mb-6", isSyncing ? "text-primary animate-spin" : "text-muted-foreground/30")} />
                  <h3 className="font-headline font-bold text-xl uppercase tracking-widest mb-4 text-white">Moteur Vectoriel Local</h3>
                  <p className="text-xs text-muted-foreground font-code mb-8 leading-relaxed">
                    Les données sont indexées physiquement dans le répertoire <span className="text-primary">/data/chromadb</span>. 
                    Ce stockage est utilisé pour la recherche sémantique ultra-rapide sans connexion internet.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-8 text-left">
                    <div className="p-4 border border-border bg-black/40 rounded-sm">
                      <p className="text-[10px] font-bold text-primary uppercase mb-1">Moteur Actif</p>
                      <p className="text-[11px] font-code text-muted-foreground truncate">{activeProvider}</p>
                    </div>
                    <div className="p-4 border border-border bg-black/40 rounded-sm">
                      <p className="text-[10px] font-bold text-secondary uppercase mb-1">Collections</p>
                      <p className="text-[11px] font-code text-muted-foreground">{(tree[0]?.children?.length || 0)} Indexées</p>
                    </div>
                  </div>

                  <Button variant="outline" size="lg" onClick={() => syncChromaState()} disabled={isSyncing} className="w-full border-primary/30 hover:border-primary text-[11px] uppercase font-code tracking-widest">
                    <RefreshCw className={cn("w-4 h-4 mr-3", isSyncing && "animate-spin")} /> Scanner le contenu physique
                  </Button>
                </>
              ) : (
                <>
                  <CloudLightning className={cn("w-16 h-16 mx-auto mb-6", isSyncing ? "text-secondary animate-pulse" : "text-muted-foreground/30")} />
                  <h3 className="font-headline font-bold text-xl uppercase tracking-widest mb-4 text-white">Registre Transit Web</h3>
                  <p className="text-xs text-muted-foreground font-code mb-8 leading-relaxed">
                    Fichier physique <span className="text-secondary">cloud_registry.json</span> servant de tampon. 
                    Les données Q/R et procédures y sont stockées avant d'être envoyées vers l'index sémantique local.
                  </p>
                  
                  <div className="space-y-4">
                    <Card className="p-6 border-secondary/20 bg-secondary/5 text-left border-dashed">
                      <div className="flex items-center gap-3 mb-3">
                        <Zap className="w-4 h-4 text-secondary" />
                        <p className="text-xs font-bold text-secondary uppercase">Action Atomique : Ingestion & Purge</p>
                      </div>
                      <p className="text-[11px] font-code text-muted-foreground leading-relaxed">
                        Le système transfère les documents du registre JSON vers ChromaDB, génère les embeddings, puis nettoie le registre web pour libérer l'espace Cloud.
                      </p>
                    </Card>
                    
                    <Button onClick={syncWebAndPurge} disabled={isSyncing} className="w-full bg-secondary text-secondary-foreground h-12 text-xs font-code uppercase font-bold shadow-lg shadow-secondary/10">
                      {isPurging ? <ShieldAlert className="w-4 h-4 mr-3 animate-bounce" /> : <RefreshCw className="w-4 h-4 mr-3" />}
                      {isPurging ? "Transfert Physique en cours..." : "Ingérer vers ChromaDB & Purger"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
