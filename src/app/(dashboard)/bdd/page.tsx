"use client";

import { useState, useEffect, useCallback } from 'react';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { 
  Folder, 
  File, 
  FolderPlus, 
  Trash2, 
  ChevronRight, 
  ChevronDown, 
  Database, 
  RefreshCw,
  Check,
  Server,
  Zap,
  CloudLightning,
  ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

type NodeType = 'file' | 'folder';

interface FSNode {
  id: string;
  name: string;
  type: NodeType;
  children?: FSNode[];
  isOpen?: boolean;
  metadata?: any;
}

const STORAGE_KEY_WEB = 'visionode_bdd_web_structure';
const STORAGE_KEY_CHROMA = 'visionode_bdd_chroma_structure';

export default function BDDPage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<'chroma' | 'web'>('chroma');
  const [tree, setTree] = useState<FSNode[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string>('RECHERCHE...');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditingValue] = useState('');

  // 1. Logique de synchronisation Physique (ChromaDB)
  const syncChromaState = useCallback(async (isAuto = false) => {
    setIsSyncing(true);
    const timestamp = new Date().toLocaleTimeString();
    
    try {
      const res = await apiClient.get<any>('/api/vector/collections');
      if (res && res.success && Array.isArray(res.collections)) {
        const providerName = res.provider || 'CHROMA';
        setActiveProvider(providerName);
        
        const chromaNodes = res.collections.map((c: any) => ({
          id: `chroma-${c.name}`,
          name: c.name,
          type: 'folder' as const,
          children: []
        }));
        
        setTree([{ 
          id: 'chroma-root', 
          name: providerName === 'WEAVIATE_CLOUD' ? 'CLASSES_CLOUD' : 'COLLECTIONS_LOCALES', 
          type: 'folder', 
          isOpen: true, 
          children: chromaNodes 
        }]);

        if (!isAuto) {
          toast({ title: "Liaison Établie", description: `Moteur ${providerName} synchronisé.` });
        }
      } else {
        throw new Error(res.error || "Moteur hors-ligne");
      }
    } catch (e: any) {
      setActiveProvider('ERREUR_LIAISON');
      if (!isAuto) {
        toast({ title: "Échec Liaison", description: "Vérifiez que l'instance ChromaDB est active.", variant: "destructive" });
      }
    } finally {
      setIsSyncing(false);
    }
  }, [toast]);

  // 2. Logique de synchronisation Web + Purge Immédiate
  const syncWebAndPurge = async () => {
    setIsSyncing(true);
    setIsPurging(true);
    
    try {
      // Étape A: Récupération des données du tampon Cloud
      const res = await apiClient.post<any>('/api/sync/download', {
        userId: 'admin',
        projectId: 'project-001',
        lastSync: new Date(0).toISOString()
      });

      if (res.items && res.items.length > 0) {
        // Étape B: Injection dans Chroma (Simulation de transfert via API)
        await apiClient.post('/api/vector/ingest', {
          items: res.items.map((i: any) => ({ question: i.tags[0], answer: i.content })),
          metadata: { collection: 'industrial_manuals', source: 'web_purge' }
        });

        // Étape C: Purge Immédiate du Cloud
        const ids = res.items.map((i: any) => i.id);
        await apiClient.post('/api/sync/cleanup', { ids, projectId: 'project-001' });

        toast({ 
          title: "Cycle de Purge Terminé", 
          description: `${ids.length} assets transférés vers Chroma et supprimés du Cloud.` 
        });
      } else {
        toast({ title: "Tampon Vide", description: "Aucune donnée en attente de purge." });
      }
      
      // Rafraîchir l'arborescence logique
      setTree([{ id: 'root', name: 'WEB_BUFFER_PURGÉ', type: 'folder', isOpen: true, children: [] }]);
    } catch (e) {
      toast({ title: "Erreur de Cycle", description: "Le transfert atomique a échoué.", variant: "destructive" });
    } finally {
      setIsSyncing(false);
      setIsPurging(false);
    }
  };

  // Chargement initial et auto-sync
  useEffect(() => {
    if (mode === 'chroma') {
      syncChromaState(true);
    } else {
      const saved = localStorage.getItem(STORAGE_KEY_WEB);
      if (saved) {
        setTree(JSON.parse(saved));
      } else {
        setTree([{ id: 'root', name: 'DATABASE_ROOT', type: 'folder', isOpen: true, children: [] }]);
      }
    }
  }, [mode, syncChromaState]);

  // Sauvegarde auto du mode Web
  useEffect(() => {
    if (mode === 'web') {
      localStorage.setItem(STORAGE_KEY_WEB, JSON.stringify(tree));
    }
  }, [tree, mode]);

  const toggleFolder = (id: string) => {
    const update = (nodes: FSNode[]): FSNode[] => nodes.map(n => {
      if (n.id === id) return { ...n, isOpen: !n.isOpen };
      if (n.children) return { ...n, children: update(n.children) };
      return n;
    });
    setTree(update(tree));
  };

  const addNode = (parentId: string, type: NodeType) => {
    const newNode: FSNode = {
      id: `node-${Date.now()}`,
      name: type === 'folder' ? 'NOUVEAU_DOSSIER' : 'nouveau_fichier.json',
      type,
      children: type === 'folder' ? [] : undefined
    };

    const update = (nodes: FSNode[]): FSNode[] => nodes.map(n => {
      if (n.id === parentId) return { ...n, isOpen: true, children: [...(n.children || []), newNode] };
      if (n.children) return { ...n, children: update(n.children) };
      return n;
    });
    setTree(update(tree));
    setEditingId(newNode.id);
    setEditingValue(newNode.name);
  };

  const deleteNode = (id: string) => {
    const update = (nodes: FSNode[]): FSNode[] => nodes.filter(n => n.id !== id).map(n => {
      if (n.children) return { ...n, children: update(n.children) };
      return n;
    });
    setTree(update(tree));
  };

  const saveRename = () => {
    if (!editingId) return;
    const update = (nodes: FSNode[]): FSNode[] => nodes.map(n => {
      if (n.id === editingId) return { ...n, name: editValue.toUpperCase() };
      if (n.children) return { ...n, children: update(n.children) };
      return n;
    });
    setTree(update(tree));
    setEditingId(null);
  };

  const renderTree = (nodes: FSNode[], depth = 0) => {
    return nodes.map(node => (
      <div key={node.id} className="select-none">
        <div 
          className={cn(
            "flex items-center gap-2 py-1 px-2 hover:bg-primary/5 cursor-pointer group rounded-sm transition-colors",
            editingId === node.id && "bg-primary/10"
          )}
          style={{ paddingLeft: `${depth * 1 + 0.5}rem` }}
        >
          {node.type === 'folder' ? (
            <button onClick={() => toggleFolder(node.id)} className="p-0.5 hover:bg-muted rounded text-muted-foreground">
              {node.isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <div className="w-4.5" />
          )}

          {node.type === 'folder' ? (
            <Folder className="w-4 h-4 text-primary shrink-0" />
          ) : (
            <File className="w-4 h-4 text-secondary shrink-0" />
          )}

          {editingId === node.id ? (
            <div className="flex items-center gap-1 flex-1">
              <Input 
                autoFocus
                value={editValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                className="h-7 py-0 px-1 text-[11px] font-code uppercase bg-background border-primary"
              />
            </div>
          ) : (
            <span className="text-[11px] font-code uppercase flex-1 truncate py-0.5" onClick={() => node.type === 'folder' && toggleFolder(node.id)}>
              {node.name}
            </span>
          )}

          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
            {node.type === 'folder' && mode === 'web' && (
              <button onClick={() => addNode(node.id, 'folder')} className="p-1 hover:text-primary"><FolderPlus className="w-3.5 h-3.5" /></button>
            )}
            {mode === 'web' && (
              <button onClick={() => deleteNode(node.id)} className="p-1 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
            )}
          </div>
        </div>
        {node.type === 'folder' && node.isOpen && node.children && (
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
              <Database className="w-4 h-4 text-primary animate-pulse" />
              <span className="font-headline font-bold text-xs lg:text-sm uppercase tracking-widest text-primary">BDD Hybride</span>
            </div>
          </div>
          
          <div className="flex bg-muted/30 p-1 rounded-sm border border-border shrink-0">
            <button 
              onClick={() => setMode('chroma')}
              className={cn(
                "px-3 py-1 text-[10px] font-code uppercase rounded-sm transition-all",
                mode === 'chroma' ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              Vecteur
            </button>
            <button 
              onClick={() => setMode('web')}
              className={cn(
                "px-3 py-1 text-[10px] font-code uppercase rounded-sm transition-all",
                mode === 'web' ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"
              )}
            >
              Web
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-6 overflow-hidden flex flex-col lg:flex-row gap-6">
          <Card className="w-full lg:w-80 flex flex-col bg-black/40 border-border overflow-hidden shadow-2xl shrink-0">
            <div className="p-3 border-b border-border bg-card/50 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Explorateur</span>
              <Badge variant="outline" className={cn("text-[8px] uppercase h-4 px-1 border-primary/30", mode === 'web' ? 'text-secondary border-secondary/30' : 'text-primary')}>
                {mode === 'web' ? 'Logique' : 'Physique'}
              </Badge>
            </div>
            <div className="flex-1 overflow-auto terminal-scroll p-2">
              {renderTree(tree)}
            </div>
          </Card>

          <div className="flex-1 flex flex-col gap-6 overflow-hidden">
            <Card className="flex-1 bg-card/30 border-border p-8 flex flex-col items-center justify-center text-center">
              {mode === 'chroma' ? (
                <>
                  <Server className={cn("w-12 h-12 mb-4", isSyncing ? "text-primary animate-spin" : "text-muted-foreground/20")} />
                  <h3 className="font-headline font-bold text-lg uppercase tracking-widest mb-2">État du Moteur Vectoriel</h3>
                  <p className="text-xs text-muted-foreground font-code max-w-sm">
                    Liaison directe vers l'instance locale ChromaDB. L'arborescence est synchronisée dès la détection du nœud.
                  </p>
                  <div className="p-4 border border-border bg-black/20 rounded-sm mt-8 w-full max-w-sm">
                    <p className="text-[10px] font-bold text-primary uppercase mb-1">Nœud Actif</p>
                    <p className="text-xs font-code text-muted-foreground truncate">{activeProvider}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => syncChromaState(false)}
                    disabled={isSyncing}
                    className="mt-6 h-9 text-[10px] font-code uppercase border-primary/30 text-primary"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5 mr-2", isSyncing && "animate-spin")} />
                    Réinterroger le Nœud
                  </Button>
                </>
              ) : (
                <>
                  <CloudLightning className={cn("w-12 h-12 mb-4", isSyncing ? "text-secondary animate-pulse" : "text-muted-foreground/20")} />
                  <h3 className="font-headline font-bold text-lg uppercase tracking-widest mb-2">Tampon Cloud (WEB)</h3>
                  <p className="text-xs text-muted-foreground font-code max-w-sm">
                    Les données collectées sur le Web doivent être synchronisées avec ChromaDB puis purgées pour assurer la confidentialité.
                  </p>
                  
                  <div className="flex flex-col gap-4 mt-8 w-full max-w-sm">
                    <Card className="p-4 border-secondary/20 bg-secondary/5 text-left">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-3.5 h-3.5 text-secondary" />
                        <p className="text-[10px] font-bold text-secondary uppercase">Action Atomique</p>
                      </div>
                      <p className="text-[10px] font-code text-muted-foreground">
                        Synchronisation locale immédiate suivie d'un nettoyage total du tampon Cloud.
                      </p>
                    </Card>

                    <Button 
                      onClick={syncWebAndPurge}
                      disabled={isSyncing}
                      className="bg-secondary text-secondary-foreground h-10 text-[10px] font-code uppercase font-bold shadow-lg"
                    >
                      {isPurging ? (
                        <ShieldAlert className="w-3.5 h-3.5 mr-2 animate-bounce" />
                      ) : (
                        <RefreshCw className={cn("w-3.5 h-3.5 mr-2", isSyncing && "animate-spin")} />
                      )}
                      {isPurging ? "Purge en cours..." : "Sync & Purge Cloud"}
                    </Button>
                  </div>
                </>
              )}
            </Card>

            <footer className="h-24 bg-primary/5 border border-primary/20 rounded-sm p-4 font-code text-[10px] uppercase text-primary/70">
              <p>&gt; MOTEUR_LOGIQUE : PRÊT</p>
              <p className="truncate">&gt; LIAISON_PHYSIQUE : {activeProvider}</p>
              <p>&gt; STATUT : {isSyncing ? "TRANSFÈRE" : isPurging ? "PURGE" : "VEILLE"}</p>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
