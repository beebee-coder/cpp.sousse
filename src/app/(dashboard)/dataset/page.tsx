'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Database,
  Plus,
  Trash2,
  Save,
  Layers,
  Mic,
  MicOff,
  RefreshCw,
  ChevronRight,
  Code,
  Loader2,
  ListChecks,
  FileJson,
  FileText,
  Volume2,
  Pencil,
  X,
  Check,
  Keyboard,
  HelpCircle,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useVoice } from '@/hooks/use-voice';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { isDesktop } from '@/lib/platform';
import { syncEngine } from '@/lib/db/sync-engine';
import { useAppMode } from '@/hooks/use-app-mode';
import { useSession } from '@/components/SessionProvider';
import { localDBBridge } from '@/lib/local-db-bridge';
import { DynamicProcedureForm } from '@/components/procedures/forms/DynamicProcedureForm';

interface QRPair {
  id: string;
  question: string;
  answer: string;
}

interface QRSessionData {
  name: string;
  pairs: QRPair[];
  createdAt: string;
}

type SmartField = 'question' | 'answer' | 'fileName' | 'description';

export default function DatasetPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useSession();
  const { localOnly, online } = useAppMode();

  const [mounted, setMounted] = useState(false);

  const [pairs, setPairs] = useState<QRPair[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [fileName, setFileName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [forgeSaving, setForgeSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('qr');
  const [activeField, setActiveField] = useState<SmartField>('question');
  const [lastTranscript, setLastTranscript] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [savedCollections, setSavedCollections] = useState<{ name: string; path: string; pairs: number; description?: string }[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const questionInputRef = useRef<HTMLInputElement>(null);
  const answerInputRef = useRef<HTMLTextAreaElement>(null);
  const fileNameInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const formCardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeFieldRef = useRef(activeField);
  useEffect(() => {
    activeFieldRef.current = activeField;
  }, [activeField]);

  const parseVoiceCommand = useCallback((raw: string, currentField: SmartField): { field: SmartField; text: string; action?: 'add' | 'send' | 'clear' } => {
    const t = raw.trim();
    const lower = t.toLowerCase();

    const fieldPatterns: { field: SmartField; patterns: RegExp[] }[] = [
      { field: 'question', patterns: [/^(?:question|q)[\s:]+(.+)$/i, /^(?:c'est quoi|quelle est la question)[\s:]+(.+)$/i] },
      { field: 'answer', patterns: [/^(?:reponse|reponse|a)[\s:]+(.+)$/i, /^(?:la reponse est|answer)[\s:]+(.+)$/i] },
      { field: 'fileName', patterns: [/^(?:nom|fichier|nom du fichier)[\s:]+(.+)$/i] },
      { field: 'description', patterns: [/^(?:description|contexte|decrire)[\s:]+(.+)$/i] },
    ];

    for (const { field, patterns } of fieldPatterns) {
      for (const regex of patterns) {
        const match = t.match(regex);
        if (match && match[1]) {
          return { field, text: match[1].trim() };
        }
      }
    }

    if (/^(?:ajouter|ajoute|add|valider|enregistrer).*$/i.test(lower)) {
      return { field: currentField, text: '', action: 'add' };
    }
    if (/^(?:envoyer|envoye|send|sauvegarder|sauvegarde).*$/i.test(lower)) {
      return { field: currentField, text: '', action: 'send' };
    }
    if (/^(?:annuler|effacer|supprimer|vider|non|annule)[\s.!?]*$/i.test(lower)) {
      return { field: currentField, text: '', action: 'clear' };
    }

    return { field: currentField, text: t };
  }, []);

  const handleAddPair = useCallback(() => {
    if (!question.trim() || !answer.trim()) {
      toast({
        variant: 'destructive',
        title: 'Champs requis',
        description: 'La question et la réponse sont obligatoires.'
      });
      return;
    }

    const newPair: QRPair = {
      id: `qr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      question: question.trim(),
      answer: answer.trim(),
    };

    setPairs(prev => [...prev, newPair]);
    setJustAddedId(newPair.id);
    setQuestion('');
    setAnswer('');
    setActiveField('question');
    setTimeout(() => setJustAddedId(null), 1200);
    if (questionInputRef.current) {
      questionInputRef.current.focus();
    }
  }, [question, answer, toast]);

  const loadSavedCollections = useCallback(async () => {
    setIsLoadingCollections(true);
    setCollectionError(null);
    try {
      const res = await apiClient.get<any>('/api/registry');
      const tree: any[] = (res as any).tree || [];
      const itemsFolder = tree.find((n: any) => n.name === 'items');
      const files: any[] = itemsFolder?.children || [];
      setSavedCollections(
        files
          .filter((f: any) => f.type === 'file')
          .map((f: any) => ({
            name: f.name,
            path: f.id || `items/${f.name}`,
            pairs: typeof f.metadata?.pairCount === 'number' ? f.metadata.pairCount : -1,
            description: f.metadata?.category,
          }))
      );
    } catch (e: any) {
      setCollectionError(e?.message || 'Lecture des collections impossible');
    } finally {
      setIsLoadingCollections(false);
    }
  }, [toast]);

  const loadCollection = useCallback(async (colPath: string) => {
    try {
      const res = await apiClient.get<any>(`/api/registry?path=${encodeURIComponent(colPath)}`);
      if (!(res as any).success) throw new Error((res as any).error || 'Lecture impossible');
      const rec = JSON.parse((res as any).content);
      if (!Array.isArray(rec?.pairs)) throw new Error('Collection Q/R invalide');
      setPairs(rec.pairs.map((p: any) => ({ id: `qr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, question: p.question, answer: p.answer })));
      setFileName((rec.title || colPath.split('/').pop() || '').replace(/\.json$/i, ''));
      setDescription(rec.description || '');
      setActiveTab('qr');
      toast({ title: 'Collection chargée', description: `${rec.pairs.length} paire(s) chargée(s) dans la session.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Chargement échoué', description: e.message });
    }
  }, [toast]);

  const deleteCollection = useCallback(async (colPath: string) => {
    try {
      const res = await apiClient.delete<any>(`/api/registry?path=${encodeURIComponent(colPath)}`);
      if (!(res as any).success) throw new Error((res as any).error || 'Suppression impossible');
      toast({ title: 'Collection supprimée', description: colPath });
      loadSavedCollections().catch(() => {});
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Suppression échouée', description: e.message });
    }
  }, [toast]);

  const handleSend = useCallback(async () => {
    if (pairs.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Session vide',
        description: "Ajoutez au moins une paire Q/R avant d'envoyer."
      });
      return;
    }

    setIsSaving(true);
    try {
      const baseFileName = fileName.trim() || description.trim() || `rag_qr_${new Date().toISOString().replace(/[:.]/g, '-').split('.')[0]}`;
      const normalizedFileName = baseFileName
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'rag_qr_collection';
      const registryFileName = normalizedFileName.toLowerCase().endsWith('.json') ? normalizedFileName : `${normalizedFileName}.json`;
      const registryPath = `items/${registryFileName}`;
      const sessionJSON = {
        type: 'qa',
        title: normalizedFileName,
        description: description.trim(),
        pairs: pairs.map(p => ({ question: p.question, answer: p.answer })),
        createdAt: new Date().toISOString(),
        registryPath: registryPath,
      };

      const isOfflineSave = localOnly || (!online && isDesktop);

      if (isOfflineSave && !isDesktop) {
        toast({
          variant: 'destructive',
          title: 'Sauvegarde impossible',
          description: localOnly
            ? 'Le mode Locale uniquement est activé. La sauvegarde cloud est désactivée.'
            : 'Aucune connexion détectée. Impossible de sauvegarder.',
        });
        return;
      }

      let savedToCloud = false;
      let savedToLocal = false;
      let indexedChroma = false;
      const indexErrors: string[] = [];

      if (!isOfflineSave) {
        const res = await apiClient.post('/api/registry', {
          path: registryPath,
          type: 'file',
          content: JSON.stringify(sessionJSON, null, 2),
        });

        if ((res as any).success) {
          savedToCloud = true;
          if (isDesktop) {
            try {
              await apiClient.post('/api/local-db', {
                fileName: registryFileName,
                content: JSON.stringify(sessionJSON, null, 2),
                metadata: {
                  knowledgeType: 'qa',
                  cloudId: (res as any).itemId,
                  tags: ['Q/R', 'entrainement', ...(description.trim() ? [description.trim()] : [])]
                },
                targetDir: 'items'
              });
              savedToLocal = true;
            } catch (e) {
              console.warn('[DATASET] Erreur écriture BDD locale via API:', e);
            }
          }
        } else {
          throw new Error((res as any).error || 'Erreur inconnue');
        }
      }

      if (isOfflineSave && isDesktop) {
        try {
          await localDBBridge.injectFile(
            registryFileName,
            JSON.stringify(sessionJSON, null, 2),
            { knowledge_type: 'qa', tags: ['Q/R', 'entrainement', ...(description.trim() ? [description.trim()] : [])] },
            'items'
          );
          savedToLocal = true;
        } catch (e: any) {
          toast({
            variant: 'destructive',
            title: 'Échec de sauvegarde locale',
            description: e.message
          });
          return;
        }
        // Miroir de cohérence : on écrit aussi dans le Registre Physique
        // (.registry/items) pour que l'intercepteur offline /api/registry et le
        // repli lexical RAG (scan de .registry/items) restent synchronisés avec
        // le miroir .local-db. Non bloquant (le miroir local a déjà réussi).
        try {
          const { upsertOfflineQA } = await import('@/lib/qr/offline-repo');
          upsertOfflineQA({
            type: 'qa',
            title: sessionJSON.title,
            description: sessionJSON.description,
            pairs: sessionJSON.pairs,
            createdAt: sessionJSON.createdAt || new Date().toISOString(),
            registryPath: sessionJSON.registryPath,
          });
        } catch (e) {
          console.warn('[DATASET] Miroir registre physique non bloquant :', e);
        }
      }

      // RAG — indexation Chroma (connexion RAG). Le miroir local est toujours
      // indexé en desktop, QUE la sauvegarde soit cloud ou offline. L'ancien
      // invoke('index_local_db') (commande Tauri non enregistrée) est remplacé
      // par l'intercepteur offline /api/local-db {action:'index'} qui appelle
      // réellement indexLocalDBFile (Chroma). Échec non bloquant mais signalé.
      if (isDesktop && savedToLocal) {
        try {
          const idxRes = await apiClient.post('/api/local-db', {
            action: 'index',
            targetPath: `items/${registryFileName}`,
          });
          if ((idxRes as any).success) {
            indexedChroma = true;
          } else if ((idxRes as any).indexed === false) {
            indexErrors.push((idxRes as any).message || 'Indexation Chroma différée');
          }
        } catch (idxErr: any) {
          indexErrors.push(idxErr?.message || 'Échec indexation Chroma');
        }
      }

      // Rafraîchit la liste des collections sauvegardées (UI).
      loadSavedCollections().catch(() => {});

      setPairs([]);
      setJustAddedId(null);
      setFileName('');
      setDescription('');
      setActiveField('question');
      if (questionInputRef.current) {
        questionInputRef.current.focus();
      }

      const saveTarget = savedToCloud ? 'REGISTRE cloud' : 'BDD Locale';
      const extraInfo = isDesktop
        ? (indexedChroma
            ? ' Indexation Chroma effectuée — la collection est désormais interrogée par le chat RAG.'
            : indexErrors.length
              ? ` Enregistré localement, mais indexation Chroma non disponible (${indexErrors.join(' ; ')}).`
              : ' Copie locale effectuée.')
        : '';
      toast({
        title: 'Sauvegarde réussie',
        description: `${pairs.length} paires Q/R enregistrées dans ${saveTarget} (${registryPath}).${extraInfo}`,
        variant: indexErrors.length && !savedToCloud ? 'destructive' : 'default',
      });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Échec de sauvegarde',
        description: e.message
      });
    } finally {
      setIsSaving(false);
    }
  }, [pairs, fileName, description, toast]);

  const handleAddPairRef = useRef(handleAddPair);
  useEffect(() => {
    handleAddPairRef.current = handleAddPair;
  }, [handleAddPair]);

  const handleSendRef = useRef(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  const voice = useVoice({
    onResult: (text) => {
      const field = activeFieldRef.current;
      const parsed = parseVoiceCommand(text, field);

      if (parsed.action === 'add') {
        handleAddPairRef.current();
        return;
      }
      if (parsed.action === 'send') {
        handleSendRef.current();
        return;
      }
      if (parsed.action === 'clear') {
        if (field === 'question') {
          setQuestion('');
          questionInputRef.current?.focus();
        } else if (field === 'answer') {
          setAnswer('');
          answerInputRef.current?.focus();
        } else if (field === 'fileName') {
          setFileName('');
          fileNameInputRef.current?.focus();
        } else if (field === 'description') {
          setDescription('');
          descriptionInputRef.current?.focus();
        }
        toast({
          title: 'Correction vocale',
          description: 'Dernière reconnaissance supprimée.',
        });
        return;
      }

      setLastTranscript(text);
      setActiveField(parsed.field);
      if (parsed.field === 'question') {
        setQuestion(prev => prev ? `${prev} ${parsed.text}` : parsed.text);
        questionInputRef.current?.focus();
      } else if (parsed.field === 'answer') {
        setAnswer(prev => prev ? `${prev} ${parsed.text}` : parsed.text);
        answerInputRef.current?.focus();
      } else if (parsed.field === 'fileName') {
        setFileName(prev => prev ? `${prev} ${parsed.text}` : parsed.text);
        fileNameInputRef.current?.focus();
      } else if (parsed.field === 'description') {
        setDescription(prev => prev ? `${prev} ${parsed.text}` : parsed.text);
        descriptionInputRef.current?.focus();
      }
    },
    onActivate: () => {
      const firstEmpty = !question.trim() ? 'question'
        : !answer.trim() ? 'answer'
        : !fileName.trim() ? 'fileName'
        : !description.trim() ? 'description'
        : null;

      if (firstEmpty) {
        setActiveField(firstEmpty);
        if (firstEmpty === 'question') questionInputRef.current?.focus();
        else if (firstEmpty === 'answer') answerInputRef.current?.focus();
        else if (firstEmpty === 'fileName') fileNameInputRef.current?.focus();
        else if (firstEmpty === 'description') descriptionInputRef.current?.focus();
      }

      const guides: Record<string, string> = {
        question: 'Dites votre question.',
        answer: 'Dites la réponse.',
        fileName: 'Dictée le nom du fichier.',
        description: 'Dictée la description.',
      };
      const target = firstEmpty || activeFieldRef.current;
      setTimeout(() => {
        voice.speak(guides[target] || 'Je vous écoute.');
      }, 400);
    },
    onCorrection: () => {
      const field = activeFieldRef.current;
      if (field === 'question') {
        setQuestion('');
        questionInputRef.current?.focus();
      } else if (field === 'answer') {
        setAnswer('');
        answerInputRef.current?.focus();
      } else if (field === 'fileName') {
        setFileName('');
        fileNameInputRef.current?.focus();
      } else if (field === 'description') {
        setDescription('');
        descriptionInputRef.current?.focus();
      }
      toast({
        title: 'Correction vocale',
        description: 'Dernière reconnaissance supprimée.',
      });
    },
    autoRestart: false,
    lang: 'fr-FR'
  });

  const handleRemovePair = useCallback((id: string) => {
    setPairs(prev => prev.filter(p => p.id !== id));
  }, []);

  const serializeAnswer = (value: any): string | null => {
    if (typeof value === 'string') return value.trim() || null;
    if (value && typeof value === 'object') {
      const parts: string[] = [];
      for (const [k, v] of Object.entries(value)) {
        if (v !== null && v !== undefined && v !== '') {
          parts.push(`${k}: ${v}`);
        }
      }
      return parts.length > 0 ? parts.join('\n') : null;
    }
    return null;
  };

  const normalizeQrPairs = useCallback((raw: any): QRPair[] => {
    const out: QRPair[] = [];
    const push = (q: any, a: any) => {
      const question = typeof q === 'string' ? q.trim() : '';
      const answer = serializeAnswer(a);
      if (question && answer) {
        out.push({
          id: `qr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          question,
          answer,
        });
      }
    };

    const parseItem = (item: any) => {
      if (!item || typeof item !== 'object') return;
      if (typeof item.question === 'string') {
        const answer =
          typeof item.answer === 'string' ? item.answer
          : typeof item.response === 'string' ? item.response
          : typeof item.reponse === 'string' ? item.reponse
          : typeof item.a === 'string' ? item.a
          : (item.answer ?? item.reponse ?? item.response);
        if (typeof answer === 'string' && answer.trim()) {
          push(item.question, answer);
          return;
        }
        if (answer && typeof answer === 'object') {
          push(item.question, answer);
          return;
        }
      }
      if (Array.isArray(item.alarmes)) {
        for (const alarme of item.alarmes) {
          if (alarme && typeof alarme === 'object' && typeof alarme.question === 'string') {
            const answer =
              typeof alarme.answer === 'string' ? alarme.answer
              : typeof alarme.response === 'string' ? alarme.response
              : typeof alarme.reponse === 'string' ? alarme.reponse
              : typeof alarme.a === 'string' ? alarme.a
              : (alarme.answer ?? alarme.reponse ?? alarme.response);
            if (typeof answer === 'string' && answer.trim()) {
              push(alarme.question, answer);
            } else if (answer && typeof answer === 'object') {
              push(alarme.question, answer);
            }
          }
        }
      }
    };

    if (Array.isArray(raw)) {
      for (const item of raw) {
        parseItem(item);
      }
      return out;
    }

    if (raw && typeof raw === 'object') {
      if (Array.isArray(raw.pairs)) {
        for (const item of raw.pairs) {
          parseItem(item);
        }
        return out;
      }
      if (Array.isArray(raw.qa)) {
        for (const item of raw.qa) {
          parseItem(item);
        }
        return out;
      }
      if (Array.isArray(raw.questions) && Array.isArray(raw.answers)) {
        const len = Math.min(raw.questions.length, raw.answers.length);
        for (let i = 0; i < len; i++) {
          push(raw.questions[i], raw.answers[i]);
        }
        return out;
      }
    }

    return out;
  }, []);

  const handleJsonUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json')) {
      toast({
        variant: 'destructive',
        title: 'Format invalide',
        description: 'Veuillez sélectionner un fichier .json',
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Fichier trop volumineux',
        description: `La taille maximale autorisée est de 5 Mo. (${(file.size / 1024 / 1024).toFixed(1)} Mo reçus)`,
      });
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const normalized = normalizeQrPairs(parsed);

      if (normalized.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Aucune paire Q/R détectée',
          description: 'Le fichier JSON ne contient pas de paires question/réponse exploitables.',
        });
        return;
      }

      const baseName = file.name.replace(/\.json$/i, '');
      setPairs(normalized);
      setFileName(baseName);
      setDescription('');
      setActiveTab('qr');
      setEditingId(null);
      setEditQuestion('');
      setEditAnswer('');

      toast({
        title: 'JSON importé',
        description: `${normalized.length} paire(s) Q/R chargée(s) depuis ${file.name}.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Échec de lecture JSON',
        description: err?.message || 'Format JSON invalide.',
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [normalizeQrPairs, toast]);

  const handleStartEdit = useCallback((pair: QRPair) => {
    setEditingId(pair.id);
    setEditQuestion(pair.question);
    setEditAnswer(pair.answer);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editQuestion.trim() || !editAnswer.trim()) {
      toast({
        variant: 'destructive',
        title: 'Champs requis',
        description: 'La question et la réponse sont obligatoires.'
      });
      return;
    }

    setPairs(prev => prev.map(p => p.id === editingId ? { ...p, question: editQuestion.trim(), answer: editAnswer.trim() } : p));
    setEditingId(null);
    setEditQuestion('');
    setEditAnswer('');

    toast({
      title: 'Q/R modifiée',
      description: 'La paire question/réponse a été mise à jour.'
    });
  }, [editingId, editQuestion, editAnswer, toast]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditQuestion('');
    setEditAnswer('');
  }, []);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      if (!isDesktop) {
        toast({
          title: 'Mode Web',
          description: 'La synchronisation locale est disponible uniquement en mode Desktop.'
        });
        return;
      }

      if (localOnly) {
        toast({
          title: 'Mode Locale uniquement',
          description: 'La synchronisation cloud est désactivée (forcée en local).'
        });
        return;
      }

      if (!online) {
        toast({
          title: 'Hors-ligne',
          description: 'Aucune connexion détectée. Impossible de synchroniser.'
        });
        return;
      }

      const userId = user?.id ?? 'user-anonymous';
      const projectId = 'project-001';
      const result = await syncEngine.syncAll(userId, projectId, localOnly);

      const parts = [
        `${result.injectedCount} item(s) transféré(s)`,
        `${result.vectorizedCount} fichier(s) vectorisé(s)`,
      ];
      if (result.skippedDuplicates > 0) parts.push(`${result.skippedDuplicates} doublon(s) ignoré(s)`);
      if (result.failedItems.length > 0) parts.push(`${result.failedItems.length} échec(s)`);

      toast({
        title: result.failedItems.length > 0 ? 'Synchronisation partielle' : 'Synchronisation terminée',
        description: parts.join(', '),
        variant: result.failedItems.length > 0 ? 'destructive' : 'default',
      });

      setPairs([]);
      setFileName('');
      setDescription('');
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Échec de synchronisation',
        description: e.message
      });
    } finally {
      setIsSyncing(false);
    }
  }, [toast]);

  const handleClearRegistre = useCallback(async () => {
    try {
      const res = await apiClient.post('/api/rag-base', { action: 'clear-registre' });
      if ((res as any).success) {
        toast({
          title: 'REGISTRE purgé',
          description: 'Le répertoire REGISTRE a été vidé.'
        });
      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erreur purge',
        description: e.message
      });
    }
  }, [toast]);

  const handleForgeSubmit = useCallback(async (data: any) => {
    setForgeSaving(true);
    try {
      const title = (data?.metadata?.title || data?.title || '').toString().trim();
      if (!title) throw new Error('Le titre de la procédure est requis.');
      const rawSteps: any[] = Array.isArray(data?.steps) ? data.steps : [];
      if (rawSteps.length === 0) throw new Error('Ajoutez au moins une étape à la séquence.');

      const meta = data?.metadata || {};
      const code = (meta.code || `PROC-${Date.now().toString().slice(-6)}`).toUpperCase()
        .replace(/[^A-Z0-9\-]/g, '');
      const category = (meta.category || 'OPERATION').toUpperCase();
      const criticality = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes((meta.criticality || '').toUpperCase())
        ? (meta.criticality as string).toUpperCase()
        : 'MEDIUM';

      const steps = rawSteps.map((s: any, i: number) => ({
        id: s?.id || `step-${Date.now()}-${i}`,
        order: i + 1,
        title: (s?.title || `Étape ${i + 1}`).toString(),
        description: s?.description || '',
        action: {
          type: s?.action?.type || 'confirmation',
          instruction: (s?.action?.instruction || s?.title || `Exécuter : ${s?.title || `Étape ${i + 1}`}`).toString(),
          ...(s?.action && typeof s.action === 'object' ? s.action : {}),
        },
        validation: {
          conditions: Array.isArray(s?.validation?.conditions) && s.validation.conditions.length > 0
            ? s.validation.conditions
            : [{ id: `val-${Date.now()}-${i}`, type: 'manual', operator: '==', value: 0, description: '', displayName: '' }],
          successExpression: s?.validation?.successExpression || 'status == OK',
          ...(s?.validation && typeof s.validation === 'object' ? s.validation : {}),
        },
      }));

      const payload = {
        title,
        code,
        description: meta.description || data?.description || '',
        category,
        criticality,
        status: 'PUBLISHED',
        steps,
        prerequisites: data?.prerequisites || { description: 'Audit standard', items: [] },
        parameters: data?.parameters || null,
        mediaLibrary: data?.mediaLibrary || null,
        postExecution: data?.postExecution || null,
        metadata: {
          title,
          code,
          category,
          department: meta.department || 'PRODUCTION',
          criticality,
          version: meta.version || '1.0.0',
          author: meta.author || { id: 'local', name: 'Local Station', role: 'operator', department: '' },
          approvers: meta.approvers || [],
          tags: meta.tags || [],
          language: meta.language || 'fr',
        },
      };

      const res = await apiClient.post<any>('/api/procedures', payload);
      if (!(res as any).success) {
        throw new Error((res as any).message || (res as any).error || 'Échec de la forge.');
      }

      const target = (res as any).offline
        ? 'Registre Physique local'
        : (res as any).provider === 'LOCAL_REGISTRY'
          ? 'Registre Physique local'
          : 'Registre cloud';
      toast({
        title: 'Procédure forgée',
        description: `« ${title} » enregistrée dans le ${target}. Visible dans le guide des procédures.`,
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Forge échouée', description: e.message });
    } finally {
      setForgeSaving(false);
    }
  }, [toast]);

  const handleAnswerKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleAddPair();
    }
  }, [handleAddPair]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [pairs.length]);

  useEffect(() => {
    if (mounted) loadSavedCollections().catch(() => {});
  }, [mounted, loadSavedCollections]);

  if (!mounted) return null;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-transparent overflow-hidden">
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <header className="border-b border-border bg-card/30 flex flex-wrap items-center gap-3 px-4 sm:px-6 py-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8 text-muted-foreground hover:text-white shrink-0">
              <ChevronRight className="w-4 h-4 rotate-180" />
            </Button>
            <Database className="w-4 h-4 text-primary shrink-0" />
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary truncate">Station de Dataset & Forge procedures</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {(localOnly || (isDesktop && !online)) && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[9px] font-code uppercase tracking-widest border-amber-500/40 text-amber-400 bg-amber-500/10',
                  localOnly && 'animate-pulse'
                )}
                title={localOnly ? 'Mode Locale uniquement forcé' : 'Mode hors-ligne (Desktop)'}
              >
                {localOnly ? '⚡ Locale' : '⚡ Hors-ligne'}
              </Badge>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSync}
              disabled={isSyncing}
              className="h-8 text-[10px] uppercase font-bold gap-2"
            >
              {isSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Synchroniser
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => router.push('/procedures/guide')}
              className="h-8 text-[10px] uppercase font-bold"
            >
              <FileText className="w-3.5 h-3.5 mr-2 text-secondary" /> Guides Procédures
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <TabsList className="bg-black/40 border border-border/40">
                  <TabsTrigger value="qr" className="text-[10px] uppercase font-bold px-4 py-2">
                    <Database className="w-3.5 h-3.5 mr-2" /> Questions / Réponses
                  </TabsTrigger>
                </TabsList>
                {activeTab === 'qr' && (
                  <Button
                    type="button"
                    size="sm"
                    variant={voice.isListening ? "destructive" : "secondary"}
                    onClick={() => voice.isListening ? voice.stopListening() : voice.startListening()}
                    disabled={!voice.isSupported}
                    className="gap-2 text-[10px] uppercase font-bold"
                  >
                    {voice.isListening ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" /> Arrêter
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" /> Parler
                      </>
                    )}
                  </Button>
                )}
              </div>
              <TabsList className="bg-black/40 border border-border/40">
                <TabsTrigger value="forge" className="text-[10px] uppercase font-bold px-4 py-2">
                  <Layers className="w-3.5 h-3.5 mr-2" /> Station de forge procedures
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Q/R Single View */}
            <TabsContent value="qr" className="flex-1 overflow-hidden focus-visible:ring-0 mt-4">
              <div className="h-full flex flex-col gap-4 max-w-4xl mx-auto pb-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xs font-headline font-bold uppercase tracking-widest text-primary">
                      Questions / Réponses
                    </h2>
                    {pairs.length > 0 && (
                      <Badge variant="secondary" className="text-[9px] font-code uppercase">
                        {pairs.length} paire{pairs.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-code text-muted-foreground uppercase tracking-widest">
                      {pairs.length} paire{pairs.length > 1 ? 's' : ''}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-7 gap-1.5 text-[9px] uppercase font-code text-muted-foreground hover:text-primary"
                    >
                      <Upload className="w-3 h-3" />
                      Importer JSON
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={handleJsonUpload}
                    />
                  </div>
                </div>

                {/* Input Form */}
                <Card className="border-border/40 bg-card/50 shadow-xl">
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] font-code text-primary border-primary/30">Q</Badge>
                          <Label className="text-[9px] font-code text-primary uppercase tracking-widest font-bold">Question</Label>
                        </div>
                        <Input
                          ref={questionInputRef}
                          value={question}
                          onChange={(e) => setQuestion(e.target.value)}
                          onFocus={() => setActiveField('question')}
                          placeholder="Saisissez ou dictez la question technique..."
                          className="h-9 text-xs font-code bg-background border-border/40 focus:border-primary/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] font-code text-secondary border-secondary/30">R</Badge>
                          <Label className="text-[9px] font-code text-secondary uppercase tracking-widest font-bold">Réponse</Label>
                        </div>
                        <div className="relative">
                          <Textarea
                            ref={answerInputRef}
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            onFocus={() => setActiveField('answer')}
                            onKeyDown={handleAnswerKeyDown}
                            placeholder="Saisissez ou dictez la réponse technique..."
                            className="text-xs font-code bg-background border-border/40 focus:border-secondary/50 min-h-[72px] resize-none pr-16"
                          />
                          <div className="absolute bottom-2 right-2 flex items-center gap-1">
                            <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-code text-muted-foreground bg-black/40 border border-border/40 rounded-sm">
                              <Keyboard className="w-2.5 h-2.5" />↵
                            </kbd>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={handleAddPair}
                      disabled={!question.trim() || !answer.trim()}
                      className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[10px] uppercase"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Ajouter à la session
                    </Button>
                  </CardContent>
                </Card>

                {/* Pairs list or empty state */}
                {pairs.length === 0 ? (
                  <Card className="border-border/30 bg-card/20 flex-1 min-h-[200px]">
                    <CardContent className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 py-8">
                      <div className="w-12 h-12 rounded-full bg-muted/30 border border-border/30 flex items-center justify-center">
                        <Database className="w-6 h-6 text-muted-foreground/50" />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-xs font-code text-muted-foreground uppercase tracking-widest">
                          Aucune paire Q/R
                        </p>
                        <p className="text-[10px] font-code text-muted-foreground/60 max-w-xs">
                          Ajoutez votre première question et réponse ci-dessus, puis envoyez vers la BDD.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-border/40 bg-card/50 shadow-xl flex-1 flex flex-col min-h-0">
                    <CardHeader className="space-y-1 pb-3 shrink-0">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileJson className="w-4 h-4 text-primary" />
                          Session
                        </CardTitle>
                        <Collapsible open={showJsonPreview} onOpenChange={setShowJsonPreview}>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 gap-1 text-[9px] font-code text-muted-foreground uppercase">
                              <Code className="w-3 h-3" />
                              {showJsonPreview ? 'Masquer' : 'Prévisualiser'} JSON
                              {showJsonPreview ? <ChevronDown className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
                            </Button>
                          </CollapsibleTrigger>
                        </Collapsible>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[9px] font-code text-primary uppercase tracking-widest font-bold">Nom du fichier</Label>
                            <Input
                              ref={fileNameInputRef}
                              value={fileName}
                              onChange={(e) => setFileName(e.target.value)}
                              onFocus={() => setActiveField('fileName')}
                              placeholder="Ex: MON_FICHIER_QR"
                              className="h-7 text-[10px] uppercase font-code bg-transparent border-border/40"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] font-code text-muted-foreground uppercase tracking-widest font-bold">Description (optionnel)</Label>
                            <Input
                              ref={descriptionInputRef}
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              onFocus={() => setActiveField('description')}
                              placeholder="Contexte, sujet, usage..."
                              className="h-7 text-[10px] uppercase font-code bg-transparent border-border/40"
                            />
                          </div>
                        </div>
                        <div className="flex items-end">
                          <Button
                            size="sm"
                            onClick={handleSend}
                            disabled={isSaving || pairs.length === 0}
                            className="h-7 gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 text-[9px] uppercase font-bold"
                          >
                            {isSaving ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Save className="w-3 h-3" />
                            )}
                            Envoyer vers BDD
                          </Button>
                        </div>
                      </div>
                      {(!fileName.trim() && !description.trim()) && (
                        <p className="text-[9px] font-code text-amber-500/80 uppercase flex items-center gap-1">
                          <HelpCircle className="w-3 h-3" />
                          Sans nom ni description : nommage automatique par horodatage.
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-hidden flex flex-col min-h-0">
                      <ScrollArea className="flex-1 px-4 pb-4">
                        <div className="space-y-2 pt-2">
                          <Collapsible open={showJsonPreview}>
                            <CollapsibleContent className="pb-3">
                              <div className="p-3 bg-black/30 border border-border/30 rounded-sm">
                                <p className="text-[9px] font-code text-muted-foreground uppercase tracking-widest font-bold mb-2">Prévisualisation JSON</p>
                                <pre className="text-[9px] font-code text-foreground/90 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto terminal-scroll">
{JSON.stringify({
  type: 'qa',
  title: (fileName.trim() || description.trim() || `rag_qr_${new Date().toISOString().replace(/[:.]/g, '-').split('.')[0]}`).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'rag_qr_collection',
  description: description.trim() || null,
  pairCount: pairs.length,
  pairs: pairs.map(p => ({ question: p.question, answer: p.answer }))
}, null, 2)}
                                </pre>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>

                          <div className="space-y-2">
                            {pairs.map((pair, index) => (
                              <Card
                                key={pair.id}
                                className={cn(
                                  "border-border/30 bg-card/30 transition-all duration-300",
                                  justAddedId === pair.id && "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10"
                                )}
                              >
                                <CardContent className="p-3">
                                  {editingId === pair.id ? (
                                    <div className="space-y-2.5">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-[9px] font-code text-primary border-primary/30">Q</Badge>
                                          <Label className="text-[9px] font-code text-primary uppercase tracking-widest font-bold">Question</Label>
                                        </div>
                                        <Input
                                          value={editQuestion}
                                          onChange={(e) => setEditQuestion(e.target.value)}
                                          className="h-8 text-xs font-code bg-background border-border/40"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-[9px] font-code text-secondary border-secondary/30">R</Badge>
                                          <Label className="text-[9px] font-code text-secondary uppercase tracking-widest font-bold">Réponse</Label>
                                        </div>
                                        <Textarea
                                          value={editAnswer}
                                          onChange={(e) => setEditAnswer(e.target.value)}
                                          className="text-xs font-code bg-background border-border/40 min-h-[60px] resize-none"
                                        />
                                      </div>
                                      <div className="flex items-center gap-2 pt-1">
                                        <Button
                                          size="sm"
                                          onClick={handleSaveEdit}
                                          className="h-7 gap-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 text-[10px] uppercase font-bold"
                                        >
                                          <Check className="w-3 h-3" /> Sauvegarder
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={handleCancelEdit}
                                          className="h-7 gap-1 text-[10px] uppercase font-bold text-muted-foreground"
                                        >
                                          <X className="w-3 h-3" /> Annuler
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-start gap-3">
                                      <div className="w-7 h-7 bg-primary/10 border border-primary/30 rounded-sm flex items-center justify-center shrink-0">
                                        <span className="text-[10px] font-code font-bold text-primary">{index + 1}</span>
                                      </div>
                                      <div className="flex-1 space-y-2 min-w-0">
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-[9px] font-code text-primary border-primary/30 px-1.5 py-0">Q</Badge>
                                            <p className="text-xs font-code text-foreground/90 leading-relaxed break-words">
                                              {pair.question}
                                            </p>
                                          </div>
                                        </div>
                                        <Separator className="bg-border/10" />
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-[9px] font-code text-secondary border-secondary/30 px-1.5 py-0">R</Badge>
                                            <p className="text-xs font-code text-foreground/80 leading-relaxed break-words">
                                              {pair.answer}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-0.5 shrink-0">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleStartEdit(pair)}
                                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                                          title="Modifier"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleRemovePair(pair.id)}
                                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                          title="Supprimer"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}

                {/* Collections sauvegardées (chargées depuis /api/registry, intercepté offline) */}
                <Card className="border-border/40 bg-card/30">
                  <CardHeader className="space-y-1 pb-3 shrink-0">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ListChecks className="w-4 h-4 text-secondary" />
                        Collections sauvegardées
                        {savedCollections.length > 0 && (
                          <Badge variant="secondary" className="text-[9px] font-code uppercase">{savedCollections.length}</Badge>
                        )}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadSavedCollections().catch(() => {})}
                        disabled={isLoadingCollections}
                        className="h-7 gap-1 text-[9px] font-code text-muted-foreground uppercase"
                      >
                        {isLoadingCollections ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Rafraîchir
                      </Button>
                    </div>
                    {collectionError && (
                      <p className="text-[9px] font-code text-destructive/80 uppercase">{collectionError}</p>
                    )}
                  </CardHeader>
                  <CardContent className="p-0">
                    {savedCollections.length === 0 ? (
                      <div className="px-4 pb-4 pt-1 text-center">
                        <p className="text-[10px] font-code text-muted-foreground/60 uppercase tracking-widest">
                          {isLoadingCollections ? 'Chargement…' : 'Aucune collection Q/R sauvegardée pour l’instant.'}
                        </p>
                      </div>
                    ) : (
                      <ScrollArea className="max-h-60 px-4 pb-4">
                        <div className="space-y-2">
                          {savedCollections.map((col) => (
                            <div
                              key={col.path}
                              className="flex items-center gap-3 p-2 rounded-sm border border-border/30 bg-card/40"
                            >
                              <FileJson className="w-4 h-4 text-primary shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-code text-foreground/90 truncate">{col.name}</p>
                                <p className="text-[9px] font-code text-muted-foreground/70">
                                  {col.pairs >= 0 ? `${col.pairs} paire${col.pairs > 1 ? 's' : ''}` : 'Q/R'}
                                  {col.description ? ` · ${col.description}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => loadCollection(col.path)}
                                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                                  title="Charger dans la session"
                                >
                                  <FileText className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteCollection(col.path)}
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Forge RAG (Sequencer) */}
            <TabsContent value="forge" className="flex-1 overflow-hidden focus-visible:ring-0 mt-4">
              <div className="h-full overflow-y-auto terminal-scroll pr-1">
                <DynamicProcedureForm onSubmit={handleForgeSubmit} isSaving={forgeSaving} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
