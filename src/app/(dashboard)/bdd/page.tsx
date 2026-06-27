"use client";

import { useState, useEffect, useCallback } from 'react';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { 
  Folder, 
  Database, 
  RefreshCw,
  HardDrive,
  FileJson,
  ChevronRight,
  ChevronDown,
  Trash2,
  Edit3,
  Eye,
  Save,
  FolderPlus,
  FilePlus,
  Type,
  Loader2,
  ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';

// ✅ CONFIGURATION HYBRIDE : S'adapte à Tauri et au Web

// ✅ En mode desktop (Tauri) : rendu statique compatible avec 'export'
// ✅ En mode web : rendu dynamique

// Interface pour les nœuds du système de fichiers
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
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'chroma' | 'web'>('web');
  const [tree, setTree] = useState<FSNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  const [newModal, setNewModal] = useState<{ isOpen: boolean; type: 'file' | 'folder'; parent: string | null }>({
    isOpen: false,
    type: 'file',
    parent: null
  });
  const [newName, setNewName] = useState('');

  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; path: string; oldName: string; type: 'file' | 'folder' }>({
    isOpen: false,
    path: '',
    oldName: '',
    type: 'file'
  });
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const mergeTreeState = useCallback((oldTree: FSNode[], newNodes: FSNode[]): FSNode[] => {
    const findNodeById = (nodes: FSNode[], id: string): FSNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findNodeById(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const applyOpen = (nodes: FSNode[]): FSNode[] => {
      return nodes.map(node => {
        const oldNode = findNodeById(oldTree, node.id);
        const isOpen = oldNode?.isOpen ?? node.isOpen;
        return {
          ...node,
          isOpen,
          children: node.children ? applyOpen(node.children) : undefined
        };
      });
    };
    return applyOpen(newNodes);
  }, []);

  const refreshRegistry = useCallback(async (isInitial = false) => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<any>('/api/registry');
      if (res.success && Array.isArray(res.tree)) {
        setTree(prev => mergeTreeState(prev, res.tree));
      }
    } catch (e) {
      if (!isInitial) toast({ title: "Erreur réseau", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, mergeTreeState]);

  const refreshChroma = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<any>('/api/vector/collections');
      if (res && res.success) {
        const chromaNodes = (res.collections || []).map((c: any) => ({
          id: `chroma-${c.name}`,
          name: `${c.name.toUpperCase()} (${c.count || 0})`,
          type: 'collection' as const
        }));
        setTree([{ id: 'root-chroma', name: 'INDEX_CHROMA', type: 'folder', isOpen: true, children: chromaNodes }]);
      }
    } catch (e) {
      setTree([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      if (mode === 'web') refreshRegistry(true);
      else refreshChroma();
    }
  }, [mode, mounted, refreshRegistry, refreshChroma]);

  const handleFileClick = async (node: FSNode) => {
    if (node.id === selectedFile) return;
    if (node.type === 'file') {
      try {
        const res = await apiClient.get<any>(`/api/registry?path=${encodeURIComponent(node.id)}`);
        if (res.success) {
          setSelectedFile(node.id);
          setFileContent(res.content);
          setIsEditing(false);
        } else {
          throw new Error(res.error);
        }
      } catch (e: any) {
        toast({ title: "Fichier indisponible", description: "Il a peut-être été supprimé.", variant: "destructive" });
        await refreshRegistry();
      }
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm(`Supprimer physiquement "${id}" et tout son contenu ?`)) return;
    
    const previousTree = [...tree];
    const removeFromTree = (nodes: FSNode[]): FSNode[] => {
      return nodes
        .filter(node => node.id !== id)
        .map(node => ({
          ...node,
          children: node.children ? removeFromTree(node.children) : undefined
        }));
    };
    
    // Mise à jour optimiste instantanée
    setTree(prev => removeFromTree(prev));
    
    // Si on supprime le fichier actuellement ouvert ou son parent
    if (selectedFile === id || (selectedFile && selectedFile.startsWith(id + '/'))) {
      setSelectedFile(null);
      setFileContent('');
    }

    try {
      const res = await apiClient.delete<any>(`/api/registry?path=${encodeURIComponent(id)}`);
      if (res.success) {
        toast({ title: "Élément supprimé du disque" });
      } else {
        throw new Error(res.error || "Erreur serveur");
      }
    } catch (error: any) {
      // Rollback en cas d'échec
      setTree(previousTree);
      toast({ 
        title: "Échec de suppression physique", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };

  const saveFileChanges = async () => {
    if (!selectedFile) return;
    try {
      const res = await apiClient.put('/api/registry', { path: selectedFile, content: fileContent });
      if (res.success) {
        setIsEditing(false);
        toast({ title: "Modification sauvegardée" });
        await refreshRegistry();
      }
    } catch (e: any) {
      toast({ title: "Erreur sauvegarde", variant: "destructive" });
    }
  };

  const createNew = async () => {
    if (!newName.trim()) return;
    const path = newModal.parent ? `${newModal.parent}/${newName}` : newName;
    const finalPath = newModal.type === 'file' && !path.endsWith('.json') ? `${path}.json` : path;
    try {
      const res = await apiClient.post('/api/registry', { path: finalPath, type: newModal.type, content: '{}' });
      if (res.success) {
        setNewModal({ ...newModal, isOpen: false });
        setNewName('');
        toast({ title: "Création réussie" });
        await refreshRegistry();
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const handleRename = async () => {
    if (!renameValue.trim()) return;
    try {
      const res = await apiClient.patch('/api/registry', { path: renameModal.path, newName: renameValue });
      if (res.success) {
        setRenameModal({ ...renameModal, isOpen: false });
        toast({ title: "Renommé avec succès" });
        await refreshRegistry();
      }
    } catch (e: any) {
      toast({ title: "Erreur lors du renommage", variant: "destructive" });
    }
  };

  const toggleFolder = (id: string) => {
    setTree(prev => {
      const update = (nodes: FSNode[]): FSNode[] => nodes.map(n => 
        n.id === id ? { ...n, isOpen: !n.isOpen } : (n.children ? { ...n, children: update(n.children) } : n)
      );
      return update(prev);
    });
  };

  const renderTree = (nodes: FSNode[], depth = 0) => {
    if (!nodes || nodes.length === 0) return null;
    return nodes.map(node => (
      <div key={node.id} className="select-none">
        <div 
          className={cn(
            "flex items-center justify-between py-1 px-2 hover:bg-primary/5 rounded-sm group cursor-pointer",
            selectedFile === node.id && "bg-primary/10 border-l-2 border-primary"
          )} 
          style={{ paddingLeft: `${depth * 1 + 0.5}rem` }}
          onClick={() => node.type === 'folder' ? toggleFolder(node.id) : handleFileClick(node)}
        >
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            {node.type === 'folder' ? (
              <div className="p-0.5 text-muted-foreground shrink-0">
                {node.isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </div>
            ) : <div className="w-4 shrink-0" />}
            {node.type === 'folder' ? <Folder className="w-3.5 h-3.5 text-primary" /> : <FileJson className="w-3.5 h-3.5 text-muted-foreground" />}
            <span className="text-[10px] font-code uppercase truncate">{node.name}</span>
          </div>
          {mode === 'web' && (
            <div className="hidden group-hover:flex items-center gap-0.5 ml-2">
              {node.type === 'folder' && <button onClick={(e) => { e.stopPropagation(); setNewModal({ isOpen: true, type: 'file', parent: node.id }); }} title="Nouveau fichier"><FilePlus className="w-3 h-3 hover:text-primary" /></button>}
              <button onClick={(e) => { e.stopPropagation(); setRenameModal({ isOpen: true, path: node.id, oldName: node.name, type: node.type as any }); setRenameValue(node.name); }} title="Renommer"><Type className="w-3 h-3 hover:text-secondary" /></button>
              <button onClick={(e) => { e.stopPropagation(); deleteItem(node.id); }} title="Supprimer radicalement"><Trash2 className="w-3 h-3 hover:text-destructive" /></button>
            </div>
          )}
        </div>
        {node.isOpen && node.children && (
          <div className="border-l border-border/50 ml-3.5">{renderTree(node.children, depth + 1)}</div>
        )}
      </div>
    ));
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-primary" />
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Gestionnaire d'Actifs Physique</span>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={() => router.push('/bank')}
              className="h-8 text-[10px] uppercase font-bold"
            >
              <ImageIcon className="w-3.5 h-3.5 mr-2" /> Banque d'images
            </Button>
            <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
              <button onClick={() => setMode('web')} className={cn("px-3 py-1 text-[10px] font-code uppercase rounded-sm", mode === 'web' ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground")}>Registre</button>
              <button onClick={() => setMode('chroma')} className={cn("px-3 py-1 text-[10px] font-code uppercase rounded-sm", mode === 'chroma' ? "bg-secondary text-secondary-foreground font-bold" : "text-muted-foreground")}>Vecteurs</button>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-6 overflow-hidden flex flex-col lg:flex-row gap-6">
          <Card className="w-full lg:w-80 flex flex-col bg-black/40 border-border overflow-hidden shrink-0">
            <div className="p-3 border-b border-border bg-card/50 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Arborescence</span>
              <div className="flex gap-1">
                {mode === 'web' && <button onClick={() => setNewModal({ isOpen: true, type: 'folder', parent: null })}><FolderPlus className="w-4 h-4 hover:text-primary" /></button>}
                <button onClick={() => mode === 'web' ? refreshRegistry() : refreshChroma()}><RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2 terminal-scroll">{renderTree(tree)}</div>
          </Card>

          <Card className="flex-1 bg-card/20 border-border flex flex-col overflow-hidden">
            {selectedFile ? (
              <>
                <div className="p-3 border-b border-border bg-black/40 flex items-center justify-between">
                  <span className="text-[11px] font-code uppercase text-white truncate max-w-[300px]">{selectedFile}</span>
                  <div className="flex gap-2">
                    {selectedFile.endsWith('.json') && (
                      <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)} className="h-7 text-[9px] uppercase">
                        {isEditing ? <Eye className="w-3 h-3 mr-2" /> : <Edit3 className="w-3 h-3 mr-2" />}
                        {isEditing ? "Aperçu" : "Éditer"}
                      </Button>
                    )}
                    {isEditing && <Button variant="secondary" size="sm" onClick={saveFileChanges} className="h-7 text-[9px] uppercase font-bold"><Save className="w-3 h-3 mr-2" /> Sauver</Button>}
                  </div>
                </div>
                <div className="flex-1 overflow-hidden relative">
                  {isEditing ? (
                    <Textarea value={fileContent} onChange={(e) => setFileContent(e.target.value)} className="w-full h-full bg-black/80 font-code text-[11px] border-none focus-visible:ring-0 p-4 resize-none terminal-scroll" spellCheck={false} />
                  ) : (
                    <div className="w-full h-full bg-black/40 p-4 overflow-auto terminal-scroll flex items-center justify-center">
                      {selectedFile.endsWith('.json') ? (
                        <pre className="font-code text-[10px] text-primary/80 whitespace-pre-wrap w-full h-full">{fileContent}</pre>
                      ) : fileContent.startsWith('data:image') ? (
                        <div className="relative group max-w-full max-h-full">
                           <img src={fileContent} className="max-w-full max-h-[70vh] rounded-sm shadow-2xl border border-primary/20 object-contain" />
                           <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-primary/40" />
                        </div>
                      ) : fileContent.startsWith('data:video') ? (
                        <video src={fileContent} controls className="max-w-full max-h-[70vh] rounded-sm shadow-2xl border border-primary/20" />
                      ) : (
                        <div className="flex flex-col items-center justify-center opacity-50">
                          <ImageIcon className="w-16 h-16 mb-4" />
                          <p className="font-code text-[10px] uppercase text-center px-4">Prévisualisation non disponible pour ce type de fichier</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                <HardDrive className="w-16 h-16 mb-4 text-primary animate-pulse" />
                <p className="font-code text-xs uppercase tracking-widest text-center px-6">Sélectionnez un actif physique</p>
              </div>
            )}
          </Card>
        </div>
      </main>

      <Dialog open={newModal.isOpen} onOpenChange={(o) => !o && setNewModal({ ...newModal, isOpen: false })}>
        <DialogContent className="bg-black border-primary/40">
          <DialogHeader><DialogTitle className="text-xs uppercase font-headline text-primary">Nouveau {newModal.type === 'file' ? 'Fichier' : 'Répertoire'}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-[10px] font-code text-muted-foreground uppercase">Cible : {newModal.parent || 'racine'}</p>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom..." className="bg-muted font-code uppercase text-xs" autoFocus onKeyDown={(e) => e.key === 'Enter' && createNew()} />
          </div>
          <DialogFooter><Button onClick={createNew} className="bg-primary text-primary-foreground font-bold uppercase text-[10px]">Créer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameModal.isOpen} onOpenChange={(o) => !o && setRenameModal({ ...renameModal, isOpen: false })}>
        <DialogContent className="bg-black border-secondary/40">
          <DialogHeader><DialogTitle className="text-xs uppercase font-headline text-secondary">Renommer l'actif</DialogTitle></DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-[10px] font-code text-muted-foreground uppercase">Ancien : {renameModal.oldName}</p>
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} placeholder="Nouveau nom..." className="bg-muted font-code uppercase text-xs" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleRename()} />
          </div>
          <DialogFooter><Button onClick={handleRename} className="bg-secondary text-secondary-foreground font-bold uppercase text-[10px]">Appliquer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

