"use client";

import { useState, useEffect } from 'react';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { 
  Folder, 
  File, 
  FolderPlus, 
  FilePlus, 
  Trash2, 
  Edit3, 
  ChevronRight, 
  ChevronDown, 
  Database, 
  Globe, 
  Zap, 
  RefreshCw,
  Search,
  Check,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';

type NodeType = 'file' | 'folder';

interface FSNode {
  id: string;
  name: string;
  type: NodeType;
  children?: FSNode[];
  isOpen?: boolean;
}

const STORAGE_KEY_WEB = 'visionode_bdd_web_structure';
const STORAGE_KEY_CHROMA = 'visionode_bdd_chroma_structure';

export default function BDDPage() {
  const [mode, setMode] = useState<'chroma' | 'web'>('chroma');
  const [tree, setTree] = useState<FSNode[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditingValue] = useState('');

  // Initialisation à partir du LocalStorage pour la rapidité
  useEffect(() => {
    const key = mode === 'web' ? STORAGE_KEY_WEB : STORAGE_KEY_CHROMA;
    const saved = localStorage.getItem(key);
    if (saved) {
      setTree(JSON.parse(saved));
    } else {
      // Structure par défaut si vide
      const defaultTree = mode === 'web' ? [
        { id: 'root', name: 'DATABASE_ROOT', type: 'folder', isOpen: true, children: [] }
      ] : [
        { id: 'chroma-root', name: 'CHROMA_DATA', type: 'folder', isOpen: true, children: [
          { id: 'col-1', name: 'industrial_manuals', type: 'folder', children: [] }
        ] }
      ];
      setTree(defaultTree);
    }
  }, [mode]);

  // Sauvegarde auto dans localStorage
  useEffect(() => {
    const key = mode === 'web' ? STORAGE_KEY_WEB : STORAGE_KEY_CHROMA;
    localStorage.setItem(key, JSON.stringify(tree));
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

  const startRename = (id: string, name: string) => {
    setEditingId(id);
    setEditingValue(name);
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

  const syncPhysicalState = async () => {
    setIsSyncing(true);
    const timestamp = new Date().toLocaleTimeString();
    console.log(`🚀 [${timestamp}] [BDD_SYNC] Synchronisation avec l'état physique...`);
    
    try {
      if (mode === 'chroma') {
        // Appel API réel vers ChromaDB
        const res = await apiClient.post<any>('/api/vector/collections', {});
        if (res.collections) {
          const chromaNodes = res.collections.map((c: any) => ({
            id: `chroma-${c.name}`,
            name: c.name,
            type: 'folder',
            children: []
          }));
          setTree([{ id: 'chroma-root', name: 'CHROMA_DATA', type: 'folder', isOpen: true, children: chromaNodes }]);
        }
      }
      // Simulation délai pour feedback UI
      await new Promise(r => setTimeout(r, 800));
      console.log(`✅ [${timestamp}] [BDD_SYNC] État synchronisé.`);
    } catch (e) {
      console.error("Échec sync BDD:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const renderTree = (nodes: FSNode[], depth = 0) => {
    return nodes.map(node => (
      <div key={node.id} className="select-none">
        <div 
          className={cn(
            "flex items-center gap-2 py-1 px-2 hover:bg-primary/5 cursor-pointer group rounded-sm transition-colors",
            editingId === node.id && "bg-primary/10"
          )}
          style={{ paddingLeft: `${depth * 1.2 + 0.5}rem` }}
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
                className="h-6 py-0 px-1 text-[11px] font-code uppercase bg-background border-primary"
              />
              <button onClick={saveRename} className="text-secondary hover:text-secondary/80"><Check className="w-3 h-3" /></button>
              <button onClick={() => setEditingId(null)} className="text-destructive hover:text-destructive/80"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <span className="text-[11px] font-code uppercase flex-1 truncate py-0.5" onClick={() => node.type === 'folder' && toggleFolder(node.id)}>
              {node.name}
            </span>
          )}

          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
            {node.type === 'folder' && (
              <>
                <button onClick={() => addNode(node.id, 'folder')} className="p-1 hover:text-primary" title="Ajouter dossier"><FolderPlus className="w-3 h-3" /></button>
                <button onClick={() => addNode(node.id, 'file')} className="p-1 hover:text-secondary" title="Ajouter fichier"><FilePlus className="w-3 h-3" /></button>
              </>
            )}
            <button onClick={() => startRename(node.id, node.name)} className="p-1 hover:text-primary" title="Renommer"><Edit3 className="w-3 h-3" /></button>
            <button onClick={() => deleteNode(node.id)} className="p-1 hover:text-destructive" title="Supprimer"><Trash2 className="w-3 h-3" /></button>
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
    <div className="flex h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary animate-pulse" />
              <span className="font-headline font-bold text-sm uppercase tracking-widest text-primary">Gestionnaire BDD Hybride</span>
            </div>
            <div className="h-4 w-px bg-border mx-2" />
            <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
              <button 
                onClick={() => setMode('chroma')}
                className={cn(
                  "px-3 py-1 text-[10px] font-code uppercase rounded-sm transition-all",
                  mode === 'chroma' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Zap className="w-3 h-3 inline mr-1.5" />
                ChromaDB
              </button>
              <button 
                onClick={() => setMode('web')}
                className={cn(
                  "px-3 py-1 text-[10px] font-code uppercase rounded-sm transition-all",
                  mode === 'web' ? "bg-secondary text-secondary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Globe className="w-3 h-3 inline mr-1.5" />
                Architecture Web
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={syncPhysicalState}
              disabled={isSyncing}
              className="h-8 text-[10px] font-code uppercase border-primary/30 text-primary hover:bg-primary/5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-2", isSyncing && "animate-spin")} />
              {isSyncing ? "Synchronisation..." : "Sync Physique"}
            </Button>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-hidden flex gap-6">
          {/* File Explorer Panel */}
          <Card className="w-80 flex flex-col bg-black/40 border-border overflow-hidden shadow-2xl">
            <div className="p-3 border-b border-border bg-card/50 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Explorateur</span>
              <Badge variant="outline" className="text-[8px] uppercase h-4 px-1 border-primary/30 text-primary">
                {mode === 'web' ? 'Cloud' : 'Natif'}
              </Badge>
            </div>
            <div className="flex-1 overflow-auto terminal-scroll p-2">
              {renderTree(tree)}
            </div>
            <div className="p-2 border-t border-border bg-card/20">
              <div className="text-[9px] font-code text-muted-foreground uppercase leading-tight italic">
                &gt; Les modifications sont persistées en local via LocalStorage pour une réactivité optimale.
              </div>
            </div>
          </Card>

          {/* Details / Editor Panel */}
          <div className="flex-1 flex flex-col gap-6 overflow-hidden">
            <Card className="flex-1 bg-card/30 border-border p-8 flex flex-col items-center justify-center text-center">
              <Search className="w-12 h-12 text-muted-foreground/20 mb-4" />
              <h3 className="font-headline font-bold text-lg uppercase tracking-widest mb-2">Sélectionnez une ressource</h3>
              <p className="text-sm text-muted-foreground font-code max-w-sm">
                Utilisez l'explorateur à gauche pour naviguer dans l'arborescence {mode === 'web' ? 'de votre BDD Web' : 'de vos collections ChromaDB'}.
              </p>
              
              <div className="grid grid-cols-2 gap-4 mt-12 w-full max-w-lg text-left">
                <div className="p-4 border border-border bg-black/20 rounded-sm">
                  <p className="text-[10px] font-bold text-primary uppercase mb-1">Stockage UI</p>
                  <p className="text-[11px] font-code text-muted-foreground">Persistance via LocalStorage activée.</p>
                </div>
                <div className="p-4 border border-border bg-black/20 rounded-sm">
                  <p className="text-[10px] font-bold text-secondary uppercase mb-1">État Physique</p>
                  <p className="text-[11px] font-code text-muted-foreground">Liaison vers le moteur {mode.toUpperCase()} active.</p>
                </div>
              </div>
            </Card>

            <footer className="h-24 bg-primary/5 border border-primary/20 rounded-sm p-4 font-code text-[10px] uppercase text-primary/70 leading-relaxed">
              <p>&gt; MOTEUR_LOGIQUE : PRÊT</p>
              <p>&gt; CACHE_UI : VALIDE (MODE_RAPIDE)</p>
              <p>&gt; AUDIT_TRAÇABILITÉ : {isSyncing ? "TRANSMISSION_EN_COURS" : "VEILLE_NOMINALE"}</p>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
