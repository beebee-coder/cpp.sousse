"use client";

import { useState, useEffect, useCallback } from 'react';
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
  ImageIcon,
  Boxes,
  ArrowLeft,
  MessageSquare,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { isDesktop } from '@/lib/platform';
import { useAppMode } from '@/hooks/use-app-mode';
import { useSession } from '@/components/SessionProvider';
import { setBddSelection, clearBddSelection } from '@/lib/bdd-selection-store';
import { localDBBridge, type FSNode as BridgeFSNode, type InjectResult } from '@/lib/local-db-bridge';
import { indexLocalDBFile, indexLocalDBFolder } from '@/lib/local-indexer';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { useEvictionToast } from '@/hooks/use-eviction-toast';
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
  size?: number;
  timestamp?: number;
  metadata?: {
    knowledgeType?: string;
    cloudId?: string;
    origin?: string;
    relPath?: string;
    collection?: string;
    indexed?: boolean;
  };
}

export default function BDDPage() {
  const { toast } = useToast();
  useEvictionToast();
  const router = useRouter();
  const { user } = useSession();
  const { mode: appMode, localOnly } = useAppMode();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'web' | 'chroma' | 'locale'>('web');
  const [tree, setTree] = useState<FSNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCloudMode, setIsCloudMode] = useState(false);

  // Disponibilité des arborescences selon le mode applicatif :
  //  - web     : uniquement « BDD Web (Registre) » ; les autres inactives.
  //  - locale  : « BDD Locale » + « ChromaDB » ; « BDD Web » inactive.
  //  - hybride : les trois arborescences affichées et activées.
  const webEnabled = appMode === 'web' || appMode === 'hybride';
  const localeEnabled = appMode === 'locale' || appMode === 'hybride';
  const chromaEnabled = appMode === 'locale' || appMode === 'hybride';

  // Alignement de l'onglet UI avec le mode applicatif :
  //  - on interdit un onglet désactivé par le mode courant ;
  //  - web pur (pas de SQLite/Tauri) → l'onglet "locale" est impossible.
  useEffect(() => {
    if (!webEnabled && mode === 'web') setMode(localeEnabled ? 'locale' : 'chroma');
    else if (!localeEnabled && mode === 'locale') setMode(webEnabled ? 'web' : 'chroma');
    else if (!chromaEnabled && mode === 'chroma') setMode(webEnabled ? 'web' : 'locale');
  }, [appMode, webEnabled, localeEnabled, chromaEnabled, mode]);

  // Synchronisation de l'onglet UI avec le flag global localOnly (Desktop) :
  //  - localOnly actif sur desktop → on bascule sur l'onglet "locale".
  //  - web pur → l'onglet "locale" est impossible, on force "web".
  useEffect(() => {
    if (localOnly && isDesktop) {
      setMode('locale');
    } else if (!isDesktop && mode === 'locale') {
      setMode('web');
    }
  }, [localOnly, isDesktop, mode]);

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

  // Suivi observabe de l'opération de vectorisation (du début à la fin)
  const [indexing, setIndexing] = useState<{ id: string | null; label: string; done: number; total: number }>({
    id: null,
    label: '',
    done: 0,
    total: 0
  });

  // Collecte récursivement tous les chemins de fichiers sous un dossier donné
  const collectFileRelPaths = (nodes: FSNode[], targetId: string): string[] => {
    const found: string[] = [];
    const walkAll = (ns: FSNode[]) => ns.forEach(n => {
      if (n.type === 'file') found.push(n.id);
      if (n.children) walkAll(n.children);
    });
    const find = (ns: FSNode[]): boolean => ns.some(n => {
      if (n.id === targetId && n.type === 'folder') { walkAll(n.children || []); return true; }
      if (n.children && find(n.children)) return true;
      return false;
    });
    find(nodes);
    return found;
  };
  const [renameValue, setRenameValue] = useState('');

  const isReadOnly = isCloudMode && mode === 'web';

  // Résout un nœud de l'arbre par son id (pour publier la sélection
  // courante vers le panneau de sync de la barre latérale).
  const findNodeById = useCallback((nodes: FSNode[], id: string): FSNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) {
        const found = findNodeById(n.children, id);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // Publie la sélection courante vers le store partagé (utilisé par le
  // bouton « Vectoriser la sélection » du SyncPanel, mode hybride). On ne
  // publie qu'en onglet « BDD Locale » : l'indexation locale opère sur le
  // FS .local-db, donc un id d'onglet Web/Chroma ne serait pas valide.
  useEffect(() => {
    if (selectedFile && mode === 'locale') {
      const node = findNodeById(tree, selectedFile);
      setBddSelection({ relPath: selectedFile, type: node?.type ?? 'file' });
    } else {
      clearBddSelection();
    }
    return () => clearBddSelection();
  }, [selectedFile, mode, tree, findNodeById]);

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
    if (mode === 'locale' && (!isDesktop || localOnly)) {
      if (!isInitial) toast({ title: "Mode locale : registre cloud indisponible", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await apiClient.get<any>('/api/registry');
      if (res.success && Array.isArray(res.tree)) {
        setIsCloudMode(res.provider === 'cloud-db');
        setTree(prev => mergeTreeState(prev, res.tree));
      }
    } catch (e) {
      if (!isInitial) toast({ title: "Erreur réseau", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, mergeTreeState]);

  const refreshChroma = useCallback(async () => {
    // En mode WEB hors-ligne, il n'existe AUCUN moteur vectoriel local côté
    // navigateur : le fetch cloud échouerait après ~15 s d'attente. On court-
    // circuite immédiatement avec un message explicite (pas de faux "erreur
    // réseau" après timeout).
    if (!isDesktop && !navigator.onLine) {
      setIsLoading(false);
      setTree([]);
      toast({ title: "ChromaDB indisponible", description: "Le moteur vectoriel local nécessite l'application desktop (mode hybride/locale).", variant: "destructive" });
      return;
    }
    // L'onglet ChromaDB est accessible en local (moteur embarqué JS en web,
    // moteur Rust natif en desktop) ainsi qu'en hybride. Il n'est bloqué
    // QUE côté cloud (Vercel) où le moteur local n'existe pas — l'API
    // /api/vector/collections renvoie alors une erreur capturée ci-dessous.
    setIsLoading(true);
    try {
      const res = await apiClient.get<any>('/api/vector/collections');
      if (res && res.success) {
        // Arborescence miroir reproduisant EXACTEMENT la structure de la BDD Locale.
        const mirrorTree: FSNode[] = Array.isArray(res.mirrorTree) ? (res.mirrorTree as FSNode[]) : [];

        // Collections système hors arborescence BDD Locale (industrial_manuals, ...)
        const otherCollections = (res.collections || [])
          .filter((c: any) => !String(c.name).startsWith('locdb-'))
          .map((c: any) => ({
            id: `chroma-${c.name}`,
            name: `${c.name.toUpperCase()} (${c.count || 0})`,
            type: 'collection' as const
          }));

        const children: FSNode[] = [...mirrorTree];
        if (otherCollections.length > 0) {
          children.push({
            id: 'other-collections',
            name: 'COLLECTIONS SYSTÈME',
            type: 'folder',
            isOpen: false,
            children: otherCollections,
            metadata: { knowledgeType: 'other' }
          });
        }

        setTree([{ id: 'root-chroma', name: 'VECTEURS CHROMADB', type: 'folder', isOpen: true, children }]);
      }
    } catch (e) {
      setTree([]);
      toast({ title: "Erreur de chargement ChromaDB", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshLocalDB = useCallback(async () => {
    setIsLoading(true);
    try {
      const tree = await localDBBridge.getTree();
      setTree(tree);
    } catch (e: any) {
      setTree([]);
      if (mode === 'locale') toast({ title: "Erreur chargement BDD locale", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [mode, toast]);

  useEffect(() => {
    if (!mounted) return;
    if (mode === 'web') {
      refreshRegistry(true);
    } else if (mode === 'chroma') {
      if (isDesktop && !localOnly) {
        refreshChroma();
      } else {
        setTree([]);
        toast({ title: "Mode locale : ChromaDB cloud indisponible", variant: "destructive" });
      }
    } else if (mode === 'locale') {
      if (isDesktop) {
        refreshLocalDB();
      } else {
        setTree([]);
        toast({ title: "BDD Locale indisponible en mode Web", variant: "destructive" });
      }
    }
  }, [mode, mounted, refreshRegistry, refreshChroma, refreshLocalDB, isDesktop, localOnly, toast]);

  const handleFileClick = async (node: FSNode) => {
    if (node.id === selectedFile) return;
    if (node.type === 'file') {
      if (mode === 'chroma' && node.metadata?.relPath) {
        try {
          const res = await apiClient.get<any>(`/api/vector/documents?relPath=${encodeURIComponent(node.metadata.relPath)}`);
          if (res.success) {
            setSelectedFile(node.id);
            setFileContent(res.content);
            setIsEditing(false);
          } else {
            throw new Error(res.error || 'NON_INDEXE');
          }
        } catch (e: any) {
          toast({ title: "Document indisponible", description: e.message, variant: "destructive" });
        }
        return;
      }
      try {
        let content: string;
        if (mode === 'locale') {
          content = await localDBBridge.getFile(node.id);
        } else {
          const res = await apiClient.get<any>(`/api/registry?path=${encodeURIComponent(node.id)}`);
          if (!res.success) throw new Error(res.error);
          content = res.content;
        }
        setSelectedFile(node.id);
        setFileContent(content);
        setIsEditing(false);
      } catch (e: any) {
        toast({ title: "Fichier indisponible", description: "Il a peut-être été supprimé.", variant: "destructive" });
        if (mode === 'locale') refreshLocalDB();
        else refreshRegistry();
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
    
    setTree(prev => removeFromTree(prev));
    
    if (selectedFile === id || (selectedFile && selectedFile.startsWith(id + '/'))) {
      setSelectedFile(null);
      setFileContent('');
    }

    try {
      if (mode === 'locale') {
        await localDBBridge.deleteItem(id);
      } else {
        const res = await apiClient.delete<any>(`/api/registry?path=${encodeURIComponent(id)}`);
        if (!res.success) throw new Error(res.error || "Erreur serveur");
      }
      toast({ title: "Élément supprimé du disque" });
    } catch (error: any) {
      setTree(previousTree);
      toast({ 
        title: "Échec de suppression physique", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };

  // Suppression d'un nœud (répertoire ou fichier) dans Vecteurs ChromaDB
  const deleteChromaNode = async (node: FSNode) => {
    if (!confirm(`Supprimer définitivement "${node.id}" de Vecteurs ChromaDB ?`)) return;
    if (!isDesktop || localOnly) {
      toast({ title: "Mode locale : suppression ChromaDB désactivée", variant: "destructive" });
      return;
    }
    try {
      let res;
      if (node.type === 'collection') {
        const name = node.id.replace(/^chroma-/, '');
        res = await apiClient.delete<any>(`/api/vector/collections?name=${encodeURIComponent(name)}`);
      } else {
        res = await apiClient.delete<any>(`/api/vector/documents?relPath=${encodeURIComponent(node.id)}`);
      }
      if (res.success) {
        toast({ title: "Supprimé de Vecteurs ChromaDB" });
        refreshChroma();
      } else {
        throw new Error(res.error || "Échec de la suppression");
      }
    } catch (e: any) {
      toast({ title: "Échec suppression ChromaDB", description: e.message, variant: "destructive" });
    }
  };

  const saveFileChanges = async () => {
    if (!selectedFile) return;
    try {
      if (mode === 'locale') {
        await localDBBridge.writeFile(selectedFile, fileContent);
      } else {
        const endpoint = '/api/registry';
        const res = await apiClient.put(endpoint, { path: selectedFile, content: fileContent });
        if (!res.success) throw new Error(res.error || "Erreur sauvegarde");
      }
      setIsEditing(false);
      toast({ title: "Modification sauvegardée" });
      if (mode === 'locale') refreshLocalDB();
      else refreshRegistry();
    } catch (e: any) {
      toast({ title: "Erreur sauvegarde", description: e.message, variant: "destructive" });
    }
  };

  const createNew = async () => {
    if (!newName.trim()) return;
    const path = newModal.parent ? `${newModal.parent}/${newName}` : newName;
    const finalPath = newModal.type === 'file' && !path.endsWith('.json') ? `${path}.json` : path;
    try {
      if (mode === 'locale') {
        if (newModal.type === 'folder') {
          await localDBBridge.createFolder(finalPath);
        } else {
          await localDBBridge.writeFile(finalPath, '{}');
        }
      } else {
        const res = await apiClient.post('/api/registry', { 
          path: finalPath, 
          type: newModal.type, 
          content: '{}' 
        });
        if (!res.success) throw new Error(res.error || "Erreur création");
      }
      setNewModal({ ...newModal, isOpen: false });
      setNewName('');
      toast({ title: "Création réussie" });
      if (mode === 'locale') refreshLocalDB();
      else refreshRegistry();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const handleRename = async () => {
    if (!renameValue.trim()) return;
    try {
      if (mode === 'locale') {
        await localDBBridge.renameItem(renameModal.path, renameValue);
      } else {
        const res = await apiClient.patch('/api/registry', { path: renameModal.path, newName: renameValue });
        if (!res.success) throw new Error(res.error || "Erreur renommage");
      }
      setRenameModal({ ...renameModal, isOpen: false });
      toast({ title: "Renommé avec succès" });
      if (mode === 'locale') await refreshLocalDB();
      else await refreshRegistry();
    } catch (e: any) {
      toast({ title: "Erreur lors du renommage", description: e.message, variant: "destructive" });
    }
  };

  const indexFile = async (relPath: string) => {
    if (indexing.id) return;
    setIndexing({ id: relPath, label: relPath, done: 0, total: 1 });
    toast({ title: "Vectorisation démarrée", description: `Indexation de ${relPath}…` });
    try {
      const result = await indexLocalDBFile(relPath);
      if (result.success) {
        toast({ title: "✅ Fichier vectorisé avec succès", description: `${relPath} → Vecteurs ChromaDB (${result.chunkCount} chunks)` });
        if (result.evicted && result.evicted > 0) {
          toast({ title: "⚠️ Contexte vectorisé évincé", description: `${result.evicted} document(s) retiré(s) par la limite LRU (50k docs / 50 Mo).`, variant: "destructive" });
        }
      } else {
        throw new Error(result.error || result.message || "Échec de l'indexation");
      }
    } catch (e: any) {
      toast({ title: "❌ Échec de la vectorisation", description: e.message, variant: "destructive" });
    } finally {
      setIndexing({ id: null, label: '', done: 0, total: 0 });
      refreshLocalDB();
      refreshChroma();
    }
  };

  const indexFolder = async (relPath: string) => {
    if (indexing.id) return;
    const files = collectFileRelPaths(tree, relPath);
    if (files.length === 0) {
      toast({ title: "Aucun fichier à vectoriser", description: "Le dossier ne contient pas de fichier texte indexable.", variant: "destructive" });
      return;
    }

    setIndexing({ id: relPath, label: relPath, done: 0, total: files.length });
    toast({ title: "Vectorisation démarrée", description: `${files.length} fichier(s) à traiter dans ${relPath}…` });

    let ok = 0;
    const failures: string[] = [];
    const CONCURRENCY = 5;

    try {
      const processChunk = async (chunk: string[]) => {
        const results = await Promise.allSettled(
          chunk.map(f =>
            indexLocalDBFile(f).then(res => ({ f, res }))
          )
        );
        for (const r of results) {
          if (r.status === 'fulfilled') {
            const { f, res } = r.value;
            if (res.success) ok++;
            else failures.push(`${f}: ${res.error || res.message || 'ERREUR'}`);
          } else {
            failures.push(`${r.reason}`);
          }
          setIndexing(prev => ({ ...prev, done: prev.done + 1 }));
        }
      };

      for (let i = 0; i < files.length; i += CONCURRENCY) {
        await processChunk(files.slice(i, i + CONCURRENCY));
      }
    } catch (e: any) {
      failures.push(`global: ${e.message}`);
    }

    setIndexing({ id: null, label: '', done: 0, total: 0 });

    if (failures.length === 0) {
      toast({ title: `✅ Dossier vectorisé avec succès`, description: `${ok}/${files.length} fichier(s) indexé(s) vers Vecteurs ChromaDB.` });
    } else {
      toast({
        title: `⚠️ Vectorisation partielle : ${ok}/${files.length}`,
        description: `${failures.length} échec(s). ${failures[0]}`,
        variant: "destructive"
      });
    }
    refreshLocalDB();
    refreshChroma();
  };

  const handleClearRegistre = useCallback(async () => {
    if (!confirm('Purger les répertoires BANK, ITEMS et PROCEDURES du REGISTRE ? Cette action est irréversible.')) return;
    try {
      const res = await apiClient.post('/api/rag-base', { action: 'clear-registre' });
      if ((res as any).success) {
        toast({ title: 'REGISTRE purgé', description: 'Les répertoires BANK, ITEMS et PROCEDURES ont été vidés.' });
        refreshRegistry();
      } else {
        throw new Error((res as any).error || 'Erreur inconnue');
      }
    } catch (e: any) {
      toast({ title: 'Erreur purge', description: e.message, variant: 'destructive' });
    }
  }, [toast, refreshRegistry]);

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
            {node.type === 'folder' ? <Folder className="w-3.5 h-3.5 text-primary" /> :
             node.type === 'collection' ? <Boxes className="w-3.5 h-3.5 text-accent" /> :
             <FileJson className="w-3.5 h-3.5 text-muted-foreground" />}
            <span className="text-[10px] font-code uppercase truncate">{node.name}</span>
            {node.metadata?.indexed && <Database className="w-3 h-3 text-accent shrink-0" />}
            {node.size && <span className="text-[9px] text-muted-foreground/60 font-code">{(node.size / 1024).toFixed(1)}KB</span>}
          </div>
          {(mode === 'web' || mode === 'locale') && !isReadOnly && (
            <div className="hidden group-hover:flex items-center gap-0.5 ml-2">
              {node.type === 'folder' && (
                <button onClick={(e) => { e.stopPropagation(); setNewModal({ isOpen: true, type: 'folder', parent: node.id }); }} title="Nouveau répertoire"><FolderPlus className="w-3 h-3 hover:text-primary" /></button>
              )}
              {mode === 'locale' && (
                indexing.id === node.id ? (
                  <Loader2 className="w-3 h-3 animate-spin text-accent" />
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); if (indexing.id) return; node.type === 'folder' ? indexFolder(node.id) : indexFile(node.id); }}
                    disabled={!!indexing.id}
                    title={node.type === 'folder' ? "Indexer et vectoriser le dossier" : "Indexer et vectoriser"}
                  >
                    <Database className={`w-3 h-3 hover:text-accent ${indexing.id ? 'opacity-40' : ''}`} />
                  </button>
                )
              )}
              <button onClick={(e) => { e.stopPropagation(); setNewModal({ isOpen: true, type: 'file', parent: node.id }); }} title="Nouveau fichier"><FilePlus className="w-3 h-3 hover:text-primary" /></button>
              <button onClick={(e) => { e.stopPropagation(); setRenameModal({ isOpen: true, path: node.id, oldName: node.name, type: node.type as any }); setRenameValue(node.name); }} title="Renommer"><Type className="w-3 h-3 hover:text-secondary" /></button>
              <button onClick={(e) => { e.stopPropagation(); deleteItem(node.id); }} title="Supprimer radicalement"><Trash2 className="w-3 h-3 hover:text-destructive" /></button>
            </div>
          )}
          {(mode === 'web' || mode === 'locale') && isReadOnly && (
            <div className="hidden group-hover:flex items-center gap-0.5 ml-2">
              <span className="text-[8px] font-code text-muted-foreground/60 uppercase">lecture seule</span>
            </div>
          )}
          {mode === 'locale' && indexing.id === node.id && (
            <span className="ml-2 text-[9px] font-code text-accent shrink-0">
              {indexing.done}/{indexing.total}
            </span>
          )}
          {mode === 'chroma' && node.id !== 'root-chroma' && node.id !== 'other-collections' && (
            <div className="hidden group-hover:flex items-center gap-0.5 ml-2">
              <button onClick={(e) => { e.stopPropagation(); deleteChromaNode(node); }} title="Supprimer de Vecteurs ChromaDB"><Trash2 className="w-3 h-3 hover:text-destructive" /></button>
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
    <div className="flex flex-col lg:flex-row h-screen bg-transparent overflow-hidden">
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <header className="border-b border-border bg-card/30 flex flex-wrap items-center gap-3 px-4 sm:px-6 py-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8 text-muted-foreground hover:text-white shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <HardDrive className="w-4 h-4 text-primary shrink-0" />
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary truncate">STATION DE FORGE RAG</span>
          </div>
          <div className="overflow-x-auto terminal-scroll shrink-0">
            <div className="flex bg-muted/40 p-0.5 rounded border border-border/40 font-code text-[10px] gap-0.5 w-max">
              <Button
                size="sm"
                variant={mode === 'web' ? 'default' : 'ghost'}
                disabled={!webEnabled}
                onClick={() => webEnabled && setMode('web')}
                title={webEnabled ? undefined : "BDD Web indisponible en mode Locale (accès au Registre cloud requis)"}
                className={cn("h-7 px-3 text-[9px] font-bold uppercase disabled:opacity-40 disabled:cursor-not-allowed", mode === 'web' ? "bg-primary text-primary-foreground hover:bg-primary/95" : "text-muted-foreground hover:text-white hover:bg-white/5")}
              >
                BDD Web (Registre)
              </Button>
              <Button
                size="sm"
                variant={mode === 'locale' ? 'default' : 'ghost'}
                disabled={!localeEnabled}
                onClick={() => localeEnabled && setMode('locale')}
                title={localeEnabled ? undefined : "BDD Locale indisponible en mode Web (pas de SQLite)"}
                className={cn("h-7 px-3 text-[9px] font-bold uppercase disabled:opacity-40 disabled:cursor-not-allowed", mode === 'locale' ? "bg-primary text-primary-foreground hover:bg-primary/95" : "text-muted-foreground hover:text-white hover:bg-white/5")}
              >
                BDD Locale
              </Button>
              <Button
                size="sm"
                variant={mode === 'chroma' ? 'default' : 'ghost'}
                disabled={!chromaEnabled}
                onClick={() => chromaEnabled && setMode('chroma')}
                title={chromaEnabled ? undefined : "ChromaDB indisponible en mode Web (moteur vectoriel local requis)"}
                className={cn("h-7 px-3 text-[9px] font-bold uppercase disabled:opacity-40 disabled:cursor-not-allowed", mode === 'chroma' ? "bg-primary text-primary-foreground hover:bg-primary/95" : "text-muted-foreground hover:text-white hover:bg-white/5")}
              >
                ChromaDB
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {mode === 'web' && !isReadOnly && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleClearRegistre}
                className="h-8 text-[10px] uppercase font-bold border-destructive/30 text-destructive hover:bg-destructive/10 gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Purger REGISTRE
              </Button>
            )}
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={() => router.push('/bank')}
              className="h-8 text-[10px] uppercase font-bold"
            >
              <ImageIcon className="w-3.5 h-3.5 mr-2" /> Banque d'images
            </Button>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-6 overflow-hidden flex flex-col lg:flex-row gap-6">
          <Card className="w-full lg:w-80 flex flex-col bg-black/40 border-border overflow-hidden shrink-0">
            <div className="p-3 border-b border-border bg-card/50 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">
                {mode === 'web' && 'Registre'}
                {mode === 'chroma' && 'Vecteurs ChromaDB'}
                {mode === 'locale' && 'BDD Locale'}
              </span>
              <div className="flex gap-1">
                {(mode === 'web' || mode === 'locale') && <button onClick={() => setNewModal({ isOpen: true, type: 'folder', parent: null })} title="Nouveau répertoire"><FolderPlus className="w-4 h-4 hover:text-primary" /></button>}
                <button onClick={() => {
                  if (mode === 'web') refreshRegistry();
                  else if (mode === 'chroma') refreshChroma();
                  else refreshLocalDB();
                }}><RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} /></button>
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
                    {selectedFile.endsWith('.json') && !isReadOnly && (
                      <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)} className="h-7 text-[9px] uppercase">
                        {isEditing ? <Eye className="w-3 h-3 mr-2" /> : <Edit3 className="w-3 h-3 mr-2" />}
                        {isEditing ? "Aperçu" : "Éditer"}
                      </Button>
                    )}
                    {isEditing && !isReadOnly && <Button variant="secondary" size="sm" onClick={saveFileChanges} className="h-7 text-[9px] uppercase font-bold"><Save className="w-3 h-3 mr-2" /> Sauver</Button>}
                    {isReadOnly && (
                      <span className="text-[9px] font-code text-muted-foreground/60 uppercase px-2">lecture seule</span>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-hidden relative">
                  {isEditing ? (
                    <Textarea value={fileContent} onChange={(e) => setFileContent(e.target.value)} className="w-full h-full bg-black/80 font-code text-[11px] border-none focus-visible:ring-0 p-4 resize-none terminal-scroll" spellCheck={false} />
                  ) : (
                    <div className="w-full h-full bg-black/40 p-4 overflow-auto terminal-scroll flex items-center justify-center">
                      {(selectedFile.endsWith('.json') || mode === 'web') ? (
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

