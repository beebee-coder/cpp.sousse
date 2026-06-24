
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
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

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

  /**
   * Fusionne l'état actuel de l'UI (dossiers ouverts) avec les nouvelles données du serveur.
   */
  const mergeTreeState = useCallback((newNodes: FSNode[], oldNodes: FSNode[]): FSNode[] => {
    const openPaths = new Set<string>();
    const collectOpen = (nodes: FSNode[]) => {
      nodes.forEach(n => {
        if (n.isOpen) openPaths.add(n.id);
        if (n.children) collectOpen(n.children);
      });
    };
    collectOpen(oldNodes);

    const applyOpen = (nodes: FSNode[]): FSNode[] => nodes.map(n => ({
      ...n,
      isOpen: openPaths.has(n.id) || n.isOpen,
      children: n.children ? applyOpen(n.children) : undefined
    }));

    return applyOpen(newNodes);
  }, []);

  const refreshRegistry = useCallback(async (isInitial = false) => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<any>('/api/registry');
      if (res.success && Array.isArray(res.tree)) {
        setTree(prev => mergeTreeState(res.tree, prev));
      } else {
        setTree([]);
      }
    } catch (e) {
      if (!isInitial) toast({ title: "Erreur de lecture physique", variant: "destructive" });
      setTree([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast, mergeTreeState]);

  const refreshChroma = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<any>('/api/vector/collections');
      if (res && res.success) {
        const chromaNodes = res.collections.map((c: any) => ({
          id: `chroma-${c.name}`,
          name: `${c.name.toUpperCase()} (${c.count || 0} DOCS)`,
          type: 'collection' as const,
          count: c.count
        }));
        setTree([{ id: 'root-chroma', name: 'INDEX_CHROMA_PERSISTENT', type: 'folder', isOpen: true, children: chromaNodes }]);
      }
    } catch (e) {
      setTree([{ id: 'error', name: 'MOTEUR_CHROMA_INDISPONIBLE', type: 'folder' }]);
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
    if (node.type === 'file') {
      try {
        const res = await apiClient.get<any>(`/api/registry?path=${encodeURIComponent(node.id)}`);
        setSelectedFile(node.id);
        setFileContent(res.content);
        setIsEditing(false);
      } catch (e) {
        toast({ title: "Échec de lecture fichier", variant: "destructive" });
      }
    }
  };

  const saveFileChanges = async () => {
    if (!selectedFile) return;
    try {
      const res = await apiClient.put('/api/registry', { 
        path: selectedFile, 
        content: fileContent 
      });
      if (res.success) {
        setIsEditing(false);
        toast({ title: "Fichier mis à jour" });
        await refreshRegistry();
      } else {
        throw new Error(res.error);
      }
    } catch (e: any) {
      toast({ title: "Erreur de sauvegarde", description: e.message, variant: "destructive" });
    }
  };

  const createNew = async () => {
    if (!newName.trim()) return;
    const path = newModal.parent ? `${newModal.parent}/${newName}` : newName;
    const finalPath = newModal.type === 'file' && !path.endsWith('.json') ? `${path}.json` : path;
    
    try {
      const res = await apiClient.post('/api/registry', { 
        path: finalPath, 
        type: newModal.type,
        content: newModal.type === 'file' ? '{}' : undefined
      });
      
      if (res.success) {
        setNewModal({ ...newModal, isOpen: false });
        setNewName('');
        toast({ title: "Création réussie" });
        await refreshRegistry();
      } else {
        throw new Error(res.error);
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const handleRename = async () => {
    if (!renameValue.trim()) return;
    let finalRename = renameValue;
    if (renameModal.type === 'file' && !finalRename.endsWith('.json')) {
      finalRename += '.json';
    }

    try {
      const res = await apiClient.patch('/api/registry', { 
        path: renameModal.path, 
        newName: finalRename 
      });
      
      if (res.success) {
        setRenameModal({ ...renameModal, isOpen: false });
        toast({ title: "Élément renommé" });
        await refreshRegistry();
      } else {
        throw new Error(res.error);
      }
    } catch (e: any) {
      toast({ title: "Erreur de renommage", description: e.message, variant: "destructive" });
    }
  };

  /**
   * Action de suppression pure et optimiste.
   * Retire l'élément instantanément de l'interface avant confirmation serveur.
   */
  const deleteItem = async (id: string) => {
    if (!confirm("Supprimer définitivement cet élément et tout son contenu physique ?")) return;
    
    // 1. Sauvegarde pour rollback en cas d'erreur
    const oldTree = JSON.parse(JSON.stringify(tree));
    
    // 2. Mise à jour optimiste IMMÉDIATE (Pure)
    const removeFromTree = (nodes: FSNode[]): FSNode[] => {
      return nodes
        .filter(node => node.id !== id)
        .map(node => ({
          ...node,
          children: node.children ? removeFromTree(node.children) : undefined
        }));
    };
    
    setTree(prev => removeFromTree(prev));
    if (selectedFile === id) setSelectedFile(null);

    // 3. Appel API réel pour suppression physique
    try {
      const res = await apiClient.delete(`/api/registry?path=${encodeURIComponent(id)}`);
      if (res.success) {
        toast({ title: "Élément supprimé physiquement" });
      } else {
        throw new Error(res.error || "Erreur serveur");
      }
    } catch (error: any) {
      toast({ title: "Échec de suppression", description: error.message, variant: "destructive" });
      // Rollback de l'état UI en cas d'échec serveur
      setTree(oldTree);
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
    if (!nodes || nodes.length === 0) {
      return depth === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 opacity-20">
          <HardDrive className="w-8 h-8 mb-2" />
          <p className="text-[9px] uppercase font-code">Registre vide</p>
        </div>
      ) : null;
    }

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
            
            {node.type === 'folder' ? <Folder className="w-3.5 h-3.5 text-primary shrink-0" /> : node.type === 'collection' ? <Database className="w-3.5 h-3.5 text-secondary shrink-0" /> : <FileJson className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
            
            <span className="text-[10px] font-code uppercase truncate py-0.5">
              {node.name}
            </span>
          </div>

          {mode === 'web' && (
            <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 ml-2">
              {node.type === 'folder' && (
                <>
                  <button title="Nouveau Fichier" onClick={(e) => { e.stopPropagation(); setNewModal({ isOpen: true, type: 'file', parent: node.id }); }} className="p-1 hover:text-primary transition-colors"><FilePlus className="w-3 h-3" /></button>
                  <button title="Nouveau Dossier" onClick={(e) => { e.stopPropagation(); setNewModal({ isOpen: true, type: 'folder', parent: node.id }); }} className="p-1 hover:text-primary transition-colors"><FolderPlus className="w-3 h-3" /></button>
                </>
              )}
              <button title="Renommer" onClick={(e) => { e.stopPropagation(); setRenameModal({ isOpen: true, path: node.id, oldName: node.name, type: node.type as any }); setRenameValue(node.name); }} className="p-1 hover:text-secondary transition-colors"><Type className="w-3 h-3" /></button>
              <button title="Supprimer" onClick={(e) => { e.stopPropagation(); deleteItem(node.id); }} className="p-1 hover:text-destructive transition-colors"><Trash2 className="w-3 h-3" /></button>
            </div>
          )}
        </div>
        {node.isOpen && node.children && (
          <div className="border-l border-border/50 ml-3.5">
            {renderTree(node.children, depth + 1)}
          </div>
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
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-primary" />
              <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Registre Physique</span>
            </div>
          </div>
          <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
            <button onClick={() => setMode('web')} className={cn("px-3 py-1 text-[10px] font-code uppercase rounded-sm transition-all", mode === 'web' ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground")}>Registre .registry/</button>
            <button onClick={() => setMode('chroma')} className={cn("px-3 py-1 text-[10px] font-code uppercase rounded-sm transition-all", mode === 'chroma' ? "bg-secondary text-secondary-foreground font-bold" : "text-muted-foreground hover:text-foreground")}>Vecteurs .data/</button>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-6 overflow-hidden flex flex-col lg:flex-row gap-6">
          <Card className="w-full lg:w-80 flex flex-col bg-black/40 border-border overflow-hidden shrink-0 shadow-2xl">
            <div className="p-3 border-b border-border bg-card/50 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                {isLoading && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                Arborescence
              </span>
              <div className="flex items-center gap-1">
                {mode === 'web' && (
                  <>
                    <button title="Racine: Dossier" onClick={() => setNewModal({ isOpen: true, type: 'folder', parent: null })} className="p-1 hover:text-primary transition-colors"><FolderPlus className="w-4 h-4" /></button>
                    <button title="Racine: Fichier" onClick={() => setNewModal({ isOpen: true, type: 'file', parent: null })} className="p-1 hover:text-primary transition-colors"><FilePlus className="w-4 h-4" /></button>
                  </>
                )}
                <Button title="Rafraîchir" variant="ghost" size="icon" className="h-6 w-6" onClick={() => mode === 'web' ? refreshRegistry() : refreshChroma()}>
                  <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto terminal-scroll p-2 bg-black/20">
              {renderTree(tree)}
            </div>
          </Card>

          <Card className="flex-1 bg-card/20 border-border flex flex-col overflow-hidden shadow-2xl">
            {selectedFile ? (
              <>
                <div className="p-3 border-b border-border bg-black/40 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <FileJson className="w-4 h-4 text-primary" />
                    <span className="text-[11px] font-code uppercase text-white truncate max-w-[200px]">{selectedFile}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setIsEditing(!isEditing)}
                      className={cn("h-7 text-[9px] uppercase", isEditing ? "text-primary" : "text-muted-foreground")}
                    >
                      {isEditing ? <Eye className="w-3 h-3 mr-2" /> : <Edit3 className="w-3 h-3 mr-2" />}
                      {isEditing ? "Aperçu" : "Éditer"}
                    </Button>
                    {isEditing && (
                      <Button variant="secondary" size="sm" onClick={saveFileChanges} className="h-7 text-[9px] uppercase font-bold px-4">
                        <Save className="w-3 h-3 mr-2" /> Sauver
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-hidden relative">
                  {isEditing ? (
                    <Textarea 
                      value={fileContent} 
                      onChange={(e) => setFileContent(e.target.value)}
                      className="w-full h-full bg-black/80 font-code text-[11px] border-none focus-visible:ring-0 p-4 resize-none terminal-scroll selection:bg-primary/30"
                      spellCheck={false}
                    />
                  ) : (
                    <div className="w-full h-full bg-black/40 p-4 overflow-auto terminal-scroll">
                      <pre className="font-code text-[10px] lg:text-[11px] text-primary/80 whitespace-pre-wrap leading-relaxed">
                        {fileContent}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                <HardDrive className="w-16 h-16 mb-4 text-primary animate-pulse" />
                <p className="font-code text-xs uppercase tracking-widest text-center px-6 leading-relaxed">
                  SÉLECTIONNEZ UN ACTIF PHYSIQUE<br/>POUR AUDIT OU MODIFICATION
                </p>
              </div>
            )}
          </Card>
        </div>
      </main>

      {/* New Item Modal */}
      <Dialog open={newModal.isOpen} onOpenChange={(o) => !o && setNewModal({ ...newModal, isOpen: false })}>
        <DialogContent className="bg-black border-primary/40 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xs uppercase font-headline text-primary flex items-center gap-2 tracking-widest">
              {newModal.type === 'file' ? <FilePlus className="w-4 h-4" /> : <FolderPlus className="w-4 h-4" />}
              Nouveau {newModal.type === 'file' ? 'Fichier' : 'Répertoire'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-[10px] font-code text-muted-foreground uppercase mb-2">Cible : .registry/{newModal.parent || 'racine'}</p>
            <input 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              placeholder={newModal.type === 'file' ? "Nom du fichier" : "Nom du répertoire"}
              className="w-full bg-muted border border-primary/20 p-2 font-code rounded-sm uppercase text-xs outline-none focus:border-primary/50"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && createNew()}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setNewModal({ ...newModal, isOpen: false })} className="text-[10px] uppercase font-bold">Annuler</Button>
            <Button onClick={createNew} className="bg-primary text-primary-foreground font-bold uppercase text-[10px] px-6">Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Modal */}
      <Dialog open={renameModal.isOpen} onOpenChange={(o) => !o && setRenameModal({ ...renameModal, isOpen: false })}>
        <DialogContent className="bg-black border-secondary/40 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xs uppercase font-headline text-secondary flex items-center gap-2 tracking-widest">
              <Type className="w-4 h-4" />
              Renommer l'actif
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-[10px] font-code text-muted-foreground uppercase mb-2">Ancien : {renameModal.oldName}</p>
            <input 
              value={renameValue} 
              onChange={(e) => setRenameValue(e.target.value)} 
              placeholder="Nouveau nom..."
              className="w-full bg-muted border border-secondary/20 p-2 font-code rounded-sm uppercase text-xs outline-none focus:border-secondary/50"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setRenameModal({ ...renameModal, isOpen: false })} className="text-[10px] uppercase font-bold">Annuler</Button>
            <Button onClick={handleRename} className="bg-secondary text-secondary-foreground font-bold uppercase text-[10px] px-6">Appliquer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
