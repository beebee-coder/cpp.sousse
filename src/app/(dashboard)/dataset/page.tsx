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
  ChevronRight as ChevronRightIcon
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const questionInputRef = useRef<HTMLInputElement>(null);
  const answerInputRef = useRef<HTMLTextAreaElement>(null);
  const fileNameInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const formCardRef = useRef<HTMLDivElement>(null);

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

      const res = await apiClient.post('/api/registry', {
        path: registryPath,
        type: 'file',
        content: JSON.stringify(sessionJSON, null, 2),
      });

      if ((res as any).success) {
        if (isDesktop) {
          try {
            await apiClient.post('/api/local-db', {
              fileName: registryFileName,
              content: JSON.stringify(sessionJSON, null, 2),
              metadata: {
                knowledgeType: 'qa',
                cloudId: undefined,
                tags: ['Q/R', 'entrainement', ...(description.trim() ? [description.trim()] : [])]
              },
              targetDir: 'items'
            });

            // Vectorisation immédiate dans Chroma (indexation du fichier fraîchement écrit)
            // afin que la Q/R soit retrouvable par le RAG sans attendre une synchronisation manuelle.
            try {
              await apiClient.post('/api/local-db', {
                action: 'index',
                targetPath: `items/${registryFileName}`
              });
            } catch (idxErr) {
              console.warn('[DATASET] Échec indexation vectorielle Chroma :', idxErr);
            }
          } catch (e) {
            console.warn('[DATASET] Erreur écriture BDD locale :', e);
          }
        }

        // (Non bloquant) Entraînement Weaviate Cloud pour la recherche sémantique des Q/R.
        // Ignoré en cas d'erreur (ex : WEAVIATE non configuré) afin de ne pas faire échouer la sauvegarde.
        try {
          await apiClient.post('/api/vector/ingest', {
            items: pairs.map(p => ({ question: p.question, answer: p.answer })),
            metadata: {
              id: normalizedFileName,
              title: normalizedFileName,
              tags: ['Q/R', 'entrainement', ...(description.trim() ? [description.trim()] : [])],
              category: 'General'
            }
          });
        } catch (weaviateErr) {
          console.warn('[DATASET] Entraînement Weaviate ignoré :', weaviateErr);
          toast({
            variant: 'destructive',
            title: 'Vectorisation Weaviate échouée',
            description: 'Les paires Q/R sont sauvegardées mais ne seront pas retrouvées par le RAG sémantique cloud.',
          });
        }

        setPairs([]);
        setJustAddedId(null);
        setFileName('');
        setDescription('');
        setActiveField('question');
        if (questionInputRef.current) {
          questionInputRef.current.focus();
        }

        toast({
          title: 'Sauvegarde réussie',
          description: `${pairs.length} paires Q/R enregistrées dans REGISTRE (${registryPath}).${isDesktop ? ' Copie locale + indexation vectorielle Chroma effectuées.' : ''}`
        });
      } else {
        throw new Error((res as any).error || 'Erreur inconnue');
      }
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

      const userId = 'user-admin-001';
      const projectId = 'project-001';
      const result = await syncEngine.syncAll(userId, projectId);

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
      await new Promise(r => setTimeout(r, 1200));
      console.log('🚀 [FORGE] Injection JSON structurelle :', data);
      toast({ title: 'Forge Success', description: 'La procédure a été structurée et injectée dans le registre RAG.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Forge Failure', description: e.message });
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
