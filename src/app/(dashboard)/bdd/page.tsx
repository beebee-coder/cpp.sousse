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
  X,
  Server
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
  const [activeProvider, setActiveProvider] = useState<string>('DÉCONNECTÉ');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditingValue] = useState('');

  useEffect(() => {
    const key = mode === 'web' ? STORAGE_KEY_WEB : STORAGE_KEY_CHROMA;
    const saved = localStorage.getItem(key);
    if (saved) {
      setTree(JSON.parse(saved));
    } else {
      const defaultTree = mode === 'web' ? [
        { id: 'root', name: 'DATABASE_ROOT', type: 'folder', isOpen: true, children: [] }
      ] : [
        { id: 'chroma-root', name: 'VECTOR_DATA', type: 'folder', isOpen: true, children: [] }
      ];
      setTree(defaultTree);
    }
  }, [mode]);

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
    
    try {
      if (mode === 'chroma') {
        const res = await apiClient.get<any>('/api/vector/collections');
        if (res && res.success && Array.isArray(res.collections)) {
          const providerName = res.provider || 'CHROMA';
          setActiveProvider(providerName);
          
          const chromaNodes = res.collections.map((c: any) => ({
            id: `chroma-${c.name}`,
            name: c.name,
            type: 'folder',
            children: []
          }));
          
          setTree([{ 
            id: 'chroma-root', 
            name: providerName === 'WEAVIATE_CLOUD' ? 'CLASSES_CLOUD' : 'COLLECTIONS_LOCALES', 
            type: 'folder', 
            isOpen: true, 
            children: chromaNodes 
          }]);
          console.log(`✅ [${timestamp}] [BDD_SYNC] Liaison ${providerName} établie.`);
        } else {
          throw new Error(res.error || "Réponse invalide");
        }
      }
    } catch (e: any) {
      console.error("❌ Échec sync BDD:", e.message);
      setActiveProvider('ERREUR_LIAISON');
    } finally {
      setIsSyncing(false);
    }
  };

  const renderTree = (nodes: FSNode[], depth = 0) => {
    return nodes.map(node => (
      <div key={node.id} className="select-none">
        <div 
          className={cn(
            "flex items-center gap-2 py-1.5 lg:py-1 px-2 hover:bg-primary/5 cursor-pointer group rounded-sm transition-colors",
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
              <button onClick={saveRename} className="text-secondary p-1"><Check className="w-4 h-4" /></button>
            </div>
          ) : (
            <span className="text-[11px] font-code uppercase flex-1 truncate py-0.5" onClick={() => node.type === 'folder' && toggleFolder(node.id)}>
              {node.name}
            </span>
          )}

          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
            {node.type === 'folder' && (
              <button onClick={() => addNode(node.id, 'folder')} className="p-1 hover:text-primary"><FolderPlus className="w-3.5 h-3.5" /></button>
            )}
            <button onClick={() => deleteNode(node.id)} className="p-1 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
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
              <span className="font-headline font-bold text-xs lg:text-sm uppercase tracking-widest text-primary truncate max-w-[120px] lg:max-w-none">BDD Hybride</span>
            </div>
          </div>
          
          <div className="flex bg-muted/30 p-1 rounded-sm border border-border shrink-0">
            <button 
              onClick={() => setMode('chroma')}
              className={cn(
                "px-2 sm:px-3 py-1 text-[9px] lg:text-[10px] font-code uppercase rounded-sm transition-all",
                mode === 'chroma' ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              Vecteur
            </button>
            <button 
              onClick={() => setMode('web')}
              className={cn(
                "px-2 sm:px-3 py-1 text-[9px] lg:text-[10px] font-code uppercase rounded-sm transition-all",
                mode === 'web' ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"
              )}
            >
              Web
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-6 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row gap-4 lg:gap-6">
          <Card className="w-full lg:w-80 flex flex-col bg-black/40 border-border overflow-hidden shadow-2xl shrink-0 max-h-[400px] lg:max-h-none">
            <div className="p-3 border-b border-border bg-card/50 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Explorateur</span>
              <Badge variant="outline" className="text-[8px] uppercase h-4 px-1 border-primary/30 text-primary">
                {mode === 'web' ? 'Logique' : 'Physique'}
              </Badge>
            </div>
            <div className="flex-1 overflow-auto terminal-scroll p-2">
              {renderTree(tree)}
            </div>
          </Card>

          <div className="flex-1 flex flex-col gap-4 lg:gap-6 overflow-hidden min-h-0">
            <Card className="flex-1 bg-card/30 border-border p-6 lg:p-8 flex flex-col items-center justify-center text-center overflow-auto">
              <Server className="w-10 h-10 lg:w-12 lg:h-12 text-muted-foreground/20 mb-4" />
              <h3 className="font-headline font-bold text-base lg:text-lg uppercase tracking-widest mb-2">État du Moteur</h3>
              <p className="text-xs lg:text-sm text-muted-foreground font-code max-w-sm">
                Liaison active vers le nœud vectoriel distant. Les modifications sont persistées.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 lg:mt-12 w-full max-w-lg text-left">
                <div className="p-3 lg:p-4 border border-border bg-black/20 rounded-sm">
                  <p className="text-[9px] lg:text-[10px] font-bold text-primary uppercase mb-1">Stockage UI</p>
                  <p className="text-[10px] lg:text-[11px] font-code text-muted-foreground">LocalStorage activé.</p>
                </div>
                <div className="p-3 lg:p-4 border border-border bg-black/20 rounded-sm">
                  <p className="text-[9px] lg:text-[10px] font-bold text-secondary uppercase mb-1">Nœud Actif</p>
                  <p className="text-[10px] lg:text-[11px] font-code text-muted-foreground truncate">{activeProvider}</p>
                </div>
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={syncPhysicalState}
                disabled={isSyncing}
                className="mt-6 h-9 text-[10px] font-code uppercase border-primary/30 text-primary w-full max-w-[200px]"
              >
                <RefreshCw className={cn("w-3.5 h-3.5 mr-2", isSyncing && "animate-spin")} />
                {isSyncing ? "Transmission..." : "Sync Physique"}
              </Button>
            </Card>

            <footer className="h-20 lg:h-24 bg-primary/5 border border-primary/20 rounded-sm p-3 lg:p-4 font-code text-[9px] lg:text-[10px] uppercase text-primary/70 overflow-hidden shrink-0">
              <p>&gt; MOTEUR_LOGIQUE : PRÊT</p>
              <p className="truncate">&gt; LIAISON_PHYSIQUE : {activeProvider}</p>
              <p>&gt; AUDIT : {isSyncing ? "TRANSMISSION" : "VEILLE"}</p>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
