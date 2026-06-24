
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
  Plus,
  Trash2,
  Edit3,
  Eye,
  Save,
  FolderPlus,
  FilePlus,
  Type
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
  const [mode, setMode] = useState<'chroma' | 'web'>('web');
  const [tree, setTree] = useState<FSNode[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Editor states
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  // New Item Modal states
  const [newModal, setNewModal] = useState<{ isOpen: boolean; type: 'file' | 'folder'; parent: string | null }>({
    isOpen: false,
    type: 'file',
    parent: null
  });
  const [newName, setNewName] = useState('');

  // Rename Modal states
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; path: string; oldName: string; type: 'file' | 'folder' }>({
    isOpen: false,
    path: '',
    oldName: '',
    type: 'file'
  });
  const [renameValue, setRenameValue] = useState('');

  const refreshRegistry = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await apiClient.get<any>('/api/registry');
      if (res.success) {
        setTree(res.tree);
      }
    } catch (e) {
      toast({ title: "Erreur de lecture", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  }, [toast]);

  const refreshChroma = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await apiClient.get<any>('/api/vector/collections');
      if (res && res.success) {
        const chromaNodes = res.collections.map((c: any) => ({
          id: `chroma-${c.name}`,
          name: `${c.name} (${c.count || 0} docs)`,
          type: 'collection' as const,
          count: c.count
        }));
        setTree([{ id: 'root-chroma', name: 'INDEX_LOCAL_CHROMA', type: 'folder', isOpen: true, children: chromaNodes }]);
      }
    } catch (e) {
      setTree([{ id: 'error', name: 'MOTEUR_INDISPONIBLE', type: 'folder' }]);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'web') refreshRegistry();
    else refreshChroma();
  }, [mode, refreshRegistry, refreshChroma]);

  const handleFileClick = async (node: FSNode) => {
    if (node.type === 'file') {
      try {
        const res = await apiClient.get<any>(`/api/registry?path=${encodeURIComponent(node.id)}`);
        setSelectedFile(node.id);
        setFileContent(res.content);
        setIsEditing(false);
      } catch (e) {
        toast({ title: "Échec de lecture", variant: "destructive" });
      }
    }
  };

  const saveFileChanges = async () => {
    if (!selectedFile) return;
    try {
      await apiClient.put('/api/registry', { 
        path: selectedFile, 
        content: fileContent 
      });
      setIsEditing(false);
      toast({ title: "Fichier mis à jour" });
    } catch (e) {
      toast({ title: "Erreur de sauvegarde", variant: "destructive" });
    }
  };

  const createNew = async () => {
    if (!newName.trim()) return;
    const path = newModal.parent ? `${newModal.parent}/${newName}` : newName;
    const finalPath = newModal.type === 'file' && !path.endsWith('.json') ? `${path}.json` : path;
    
    try {
      await apiClient.post('/api/registry', { 
        path: finalPath, 
        type: newModal.type,
        content: newModal.type === 'file' ? '{}' : undefined
      });
      setNewModal({ ...newModal, isOpen: false });
      setNewName('');
      refreshRegistry();
      toast({ title: newModal.type === 'file' ? "Fichier créé" : "Répertoire créé" });
    } catch (e) {
      toast({ title: "Erreur de création", variant: "destructive" });
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
        if (selectedFile === renameModal.path) setSelectedFile(null);
        refreshRegistry();
        toast({ title: "Élément renommé" });
      }
    } catch (e) {
      toast({ title: "Erreur de renommage", variant: "destructive" });
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Supprimer définitivement cet élément et tout son contenu physique ?")) return;
    try {
      const res = await apiClient.delete(`/api/registry?path=${encodeURIComponent(id)}`);
      if (res.error) throw new Error(res.error);
      
      if (selectedFile === id) setSelectedFile(null);
      refreshRegistry();
      toast({ title: "Élément supprimé physiquement" });
    } catch (e) {
      toast({ title: "Erreur de suppression", variant: "destructive" });
    }
  };

  const toggleFolder = (id: string) => {
    const update = (nodes: FSNode[]): FSNode[] => nodes.map(n => 
      n.id === id ? { ...n, isOpen: !n.isOpen } : (n.children ? { ...n, children: update(n.children) } : n)
    );
    setTree(update(tree));
  };

  const renderTree = (nodes: FSNode[], depth = 0) => {
    return nodes.map(node => (
      <div key={node.id} className="select-none">
        <div 
          className={cn(
            "flex items-center justify-between py-1 px-2 hover:bg-primary/5 rounded-sm group",
            selectedFile === node.id && "bg-primary/10 border-l-2 border-primary"
          )} 
          style={{ paddingLeft: `${depth * 1 + 0.5}rem` }}
        >
          <div className="flex items-center gap-2 overflow-hidden flex-1" onClick={() => node.type === 'folder' ? toggleFolder(node.id) : handleFileClick(node)}>
            {node.type === 'folder' ? (
              <button className="p-0.5 text-muted-foreground">
                {node.isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : <div className="w-4" />}
            
            {node.type === 'folder' ? <Folder className="w-3.5 h-3.5 text-primary" /> : node.type === 'collection' ? <Database className="w-3.5 h-3.5 text-secondary" /> : <FileJson className="w-3.5 h-3.5 text-muted-foreground" />}
            
            <span className="text-[10px] font-code uppercase truncate py-0.5 cursor-pointer">
              {node.name}
            </span>
          </div>

          {mode === 'web' && (
            <div className="hidden group-hover:flex items-center gap-0.5">
              {node.type === 'folder' && (
                <>
                  <button title="Nouveau Fichier" onClick={(e) => { e.stopPropagation(); setNewModal({ isOpen: true, type: 'file', parent: node.id }); }} className="p-1 hover:text-primary"><FilePlus className="w-3 h-3" /></button>
                  <button title="Nouveau Sous-Répertoire" onClick={(e) => { e.stopPropagation(); setNewModal({ isOpen: true, type: 'folder', parent: node.id }); }} className="p-1 hover:text-primary"><FolderPlus className="w-3 h-3" /></button>
                </>
              )}
              <button title="Renommer" onClick={(e) => { e.stopPropagation(); setRenameModal({ isOpen: true, path: node.id, oldName: node.name, type: node.type as any }); setRenameValue(node.name); }} className="p-1 hover:text-secondary"><Type className="w-3 h-3" /></button>
              <button title="Supprimer" onClick={(e) => { e.stopPropagation(); deleteItem(node.id); }} className="p-1 hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
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

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-primary" />
              <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Gestionnaire de Structure Physique</span>
            </div>
          </div>
          <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
            <button onClick={() => setMode('web')} className={cn("px-3 py-1 text-[10px] font-code uppercase rounded-sm", mode === 'web' ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground")}>Registre /registry</button>
            <button onClick={() => setMode('chroma')} className={cn("px-3 py-1 text-[10px] font-code uppercase rounded-sm", mode === 'chroma' ? "bg-secondary text-secondary-foreground font-bold" : "text-muted-foreground")}>Moteur Chroma</button>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-6 overflow-hidden flex flex-col lg:flex-row gap-6">
          {/* Sidebar Tree */}
          <Card className="w-full lg:w-80 flex flex-col bg-black/40 border-border overflow-hidden shrink-0">
            <div className="p-3 border-b border-border bg-card/50 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Arborescence</span>
              <div className="flex items-center gap-1">
                {mode === 'web' && (
                  <>
                    <Button title="Nouveau Répertoire Racine" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setNewModal({ isOpen: true, type: 'folder', parent: null })}>
                      <FolderPlus className="w-3.5 h-3.5" />
                    </Button>
                    <Button title="Nouveau Fichier Racine" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setNewModal({ isOpen: true, type: 'file', parent: null })}>
                      <FilePlus className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
                <Button title="Rafraîchir" variant="ghost" size="icon" className="h-6 w-6" onClick={() => mode === 'web' ? refreshRegistry() : refreshChroma()}>
                  <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto terminal-scroll p-2">
              {renderTree(tree)}
            </div>
          </Card>

          {/* Main Viewer/Editor */}
          <Card className="flex-1 bg-card/20 border-border flex flex-col overflow-hidden">
            {selectedFile ? (
              <>
                <div className="p-3 border-b border-border bg-black/40 flex items-center justify-between">
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
                      <Button variant="secondary" size="sm" onClick={saveFileChanges} className="h-7 text-[9px] uppercase font-bold">
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
                      className="w-full h-full bg-black/80 font-code text-[11px] border-none focus-visible:ring-0 p-4 resize-none terminal-scroll"
                    />
                  ) : (
                    <div className="w-full h-full bg-black/40 p-4 overflow-auto terminal-scroll">
                      <pre className="font-code text-[10px] lg:text-[11px] text-primary/80 whitespace-pre-wrap">
                        {fileContent}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                <Database className="w-16 h-16 mb-4" />
                <p className="font-code text-xs uppercase tracking-widest text-center px-6">
                  SÉLECTIONNEZ UN ACTIF PHYSIQUE<br/>POUR AUDIT OU MODIFICATION
                </p>
              </div>
            )}
          </Card>
        </div>
      </main>

      {/* New Item Modal */}
      <Dialog open={newModal.isOpen} onOpenChange={(o) => !o && setNewModal({ ...newModal, isOpen: false })}>
        <DialogContent className="bg-black border-primary/40">
          <DialogHeader>
            <DialogTitle className="text-xs uppercase font-headline text-primary flex items-center gap-2">
              {newModal.type === 'file' ? <FilePlus className="w-4 h-4" /> : <FolderPlus className="w-4 h-4" />}
              Nouveau {newModal.type === 'file' ? 'Fichier' : 'Répertoire'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-[10px] font-code text-muted-foreground uppercase mb-2">Emplacement cible : registry/{newModal.parent || 'racine'}</p>
            <Input 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              placeholder={newModal.type === 'file' ? "Nom du fichier (ex: config_moteur)" : "Nom du répertoire"}
              className="bg-muted font-code h-10 uppercase"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewModal({ ...newModal, isOpen: false })} className="text-[10px] uppercase">Annuler</Button>
            <Button onClick={createNew} className="bg-primary text-primary-foreground font-bold uppercase text-[10px]">Confirmer Création</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Modal */}
      <Dialog open={renameModal.isOpen} onOpenChange={(o) => !o && setRenameModal({ ...renameModal, isOpen: false })}>
        <DialogContent className="bg-black border-secondary/40">
          <DialogHeader>
            <DialogTitle className="text-xs uppercase font-headline text-secondary flex items-center gap-2">
              <Type className="w-4 h-4" />
              Renommer l'élément
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-[10px] font-code text-muted-foreground uppercase mb-2">Source actuelle : {renameModal.oldName}</p>
            <Input 
              value={renameValue} 
              onChange={(e) => setRenameValue(e.target.value)} 
              placeholder="Nouveau nom technique..."
              className="bg-muted font-code h-10 uppercase"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameModal({ ...renameModal, isOpen: false })} className="text-[10px] uppercase">Annuler</Button>
            <Button onClick={handleRename} className="bg-secondary text-secondary-foreground font-bold uppercase text-[10px]">Appliquer le changement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
