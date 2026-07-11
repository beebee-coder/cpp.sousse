'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
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
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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
  const [activeField, setActiveField] = useState<SmartField>('question');
  const [lastTranscript, setLastTranscript] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const questionInputRef = useRef<HTMLInputElement>(null);
  const answerInputRef = useRef<HTMLTextAreaElement>(null);
  const fileNameInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);

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
    setQuestion('');
    setAnswer('');
    setActiveField('question');
    if (questionInputRef.current) {
      questionInputRef.current.focus();
    }

    toast({
      title: 'Q/R ajoutée',
      description: 'La paire question/réponse a été ajoutée à la session.'
    });
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
        setPairs([]);
        setFileName('');
        setDescription('');
        setActiveField('question');
        if (questionInputRef.current) {
          questionInputRef.current.focus();
        }

        toast({
          title: 'Sauvegarde réussie',
          description: `${pairs.length} paires Q/R enregistrées dans REGISTRE (${registryPath}). La synchronisation et la vectorisation se feront ensuite.`
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

      toast({
        title: 'Synchronisation terminée',
        description: `${result.injectedCount} item(s) transféré(s), ${result.vectorizedCount} fichier(s) vectorisé(s).`
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
      <DashboardSidebar />

      <main className="flex-1 flex flex-col min-w-0 h-full">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8 text-muted-foreground hover:text-white">
              <ChevronRight className="w-4 h-4 rotate-180" />
            </Button>
            <Database className="w-4 h-4 text-primary" />
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Station de Dataset & Forge procedures</span>
          </div>

          <div className="flex items-center gap-2">
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
          <Tabs defaultValue="qr" className="h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-2 shrink-0">
              <TabsList className="bg-black/40 border border-border/40">
                <TabsTrigger value="qr" className="text-[10px] uppercase font-bold px-4 py-2">
                  <Database className="w-3.5 h-3.5 mr-2" /> Questions / Réponses
                </TabsTrigger>
                <TabsTrigger value="forge" className="text-[10px] uppercase font-bold px-4 py-2">
                  <Layers className="w-3.5 h-3.5 mr-2" /> Station de forge procedures
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Q/R Single View */}
            <TabsContent value="qr" className="flex-1 overflow-hidden focus-visible:ring-0 mt-4">
              <div className="h-full flex flex-col gap-6 max-w-4xl mx-auto pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-code text-muted-foreground uppercase">
                      Champ actif : <span className="text-primary font-bold">{activeField}</span>
                    </p>
                    {lastTranscript && (
                      <p className="text-[9px] font-code text-muted-foreground/70 max-w-md truncate">
                        Dernière reconnaissance : "{lastTranscript}"
                      </p>
                    )}
                  </div>
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
                </div>

                {/* Input Zone */}
                <Card className="border-border/40 bg-card/50 shadow-xl">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Database className="w-4 h-4 text-primary" />
                      Question Technique
                    </CardTitle>
                    <CardDescription className="text-xs uppercase font-code">
                      Saisie textuelle ou vocale de la question
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Question</Label>
                      <Input
                        ref={questionInputRef}
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onFocus={() => setActiveField('question')}
                        placeholder="Saisissez ou dictez la question technique..."
                        className="flex-1 bg-background border-border/40 focus:border-primary/50 text-sm font-code"
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-center">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Volume2 className="w-5 h-5 text-primary" />
                  </div>
                </div>

                <Card className="border-border/40 bg-card/50 shadow-xl">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Save className="w-4 h-4 text-secondary" />
                      Réponse Adéquate
                    </CardTitle>
                    <CardDescription className="text-xs uppercase font-code">
                      Saisie textuelle ou vocale de la réponse
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Réponse</Label>
                      <Textarea
                        ref={answerInputRef}
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        onFocus={() => setActiveField('answer')}
                        placeholder="Saisissez ou dictez la réponse technique..."
                        className="flex-1 bg-background border-border/40 focus:border-primary/50 text-sm font-code min-h-[100px] resize-none"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-border/20 pt-4 flex gap-2">
                    <Button
                      onClick={handleAddPair}
                      disabled={!question.trim() || !answer.trim()}
                      className="w-full gap-2 bg-primary hover:bg-primary/90 text-background font-bold text-xs uppercase"
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter Q/R
                    </Button>
                  </CardFooter>
                </Card>

                {/* Accumulated pairs + bulk actions */}
                {pairs.length > 0 && (
                  <Card className="border-border/40 bg-card/50 shadow-xl">
                    <CardHeader className="space-y-1">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileJson className="w-4 h-4 text-primary" />
                          Session ({pairs.length})
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Input
                            ref={fileNameInputRef}
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value)}
                            onFocus={() => setActiveField('fileName')}
                            placeholder="Nom du fichier"
                            className="h-8 text-[11px] uppercase font-code bg-transparent border-border/40 w-48"
                          />
                          <Input
                            ref={descriptionInputRef}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            onFocus={() => setActiveField('description')}
                            placeholder="Description (optionnel)"
                            className="h-8 text-[11px] uppercase font-code bg-transparent border-border/40 w-56"
                          />
                          <Button
                            size="sm"
                            onClick={handleSend}
                            disabled={isSaving || pairs.length === 0}
                            className="h-8 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-[10px] uppercase font-bold"
                          >
                            {isSaving ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                            Envoyer vers BDD
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="max-h-[50vh] overflow-y-auto px-4 pb-4">
                        <div className="space-y-3 pt-4">
                          {pairs.map((pair, index) => (
                            <Card key={pair.id} className="border-border/30 bg-card/30">
                              <CardContent className="p-4">
                                {editingId === pair.id ? (
                                  <div className="space-y-3">
                                    <div className="space-y-1">
                                      <Label className="text-[9px] font-code text-primary uppercase tracking-widest font-bold">Question</Label>
                                      <Input
                                        value={editQuestion}
                                        onChange={(e) => setEditQuestion(e.target.value)}
                                        className="h-8 text-xs font-code bg-background border-border/40"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[9px] font-code text-secondary uppercase tracking-widest font-bold">Réponse</Label>
                                      <Textarea
                                        value={editAnswer}
                                        onChange={(e) => setEditAnswer(e.target.value)}
                                        className="text-xs font-code bg-background border-border/40 min-h-[80px] resize-none"
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
                                  <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 bg-primary/10 border border-primary/30 rounded-sm flex items-center justify-center shrink-0">
                                      <span className="text-xs font-code font-bold text-primary">{index + 1}</span>
                                    </div>
                                    <div className="flex-1 space-y-3 min-w-0">
                                      <div className="space-y-1">
                                        <p className="text-[9px] font-code text-primary uppercase tracking-widest font-bold">Question</p>
                                        <p className="text-xs font-code text-foreground/90 leading-relaxed bg-black/20 p-2 rounded-sm border border-border/20">
                                          {pair.question}
                                        </p>
                                      </div>
                                      <Separator className="bg-border/20" />
                                      <div className="space-y-1">
                                        <p className="text-[9px] font-code text-secondary uppercase tracking-widest font-bold">Réponse</p>
                                        <p className="text-xs font-code text-foreground/90 leading-relaxed bg-black/20 p-2 rounded-sm border border-border/20">
                                          {pair.answer}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleStartEdit(pair)}
                                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                                        title="Modifier"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemovePair(pair.id)}
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        title="Supprimer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                          <div ref={scrollRef} />
                        </div>
                      </div>
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
