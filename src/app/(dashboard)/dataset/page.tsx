"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Database, 
  Plus, 
  UploadCloud, 
  Layers,
  Mic,
  MicOff,
  Sparkles,
  Loader2,
  AlertTriangle,
  Trash2
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { useVoice } from '@/hooks/use-voice';
import { cn } from '@/lib/utils';

interface ProcedureStep {
  id: string;
  title: string;
  duration: string;
}

interface QAItem {
  id: string;
  type: 'qa' | 'procedure';
  label: string;
  details: string;
}

export default function DatasetPage() {
  // --- 1. TOUS LES HOOKS AU SOMMET (ORDRE CONSTANT) ---
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'qa' | 'procedure'>('qa');
  const [qaItems, setQaItems] = useState<QAItem[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [procTitle, setProcTitle] = useState('');
  const [procSteps, setProcSteps] = useState<ProcedureStep[]>([
    { id: '1', title: '', duration: '' }
  ]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGuideActive, setIsGuideActive] = useState(false);
  const [activeUIField, setActiveUIField] = useState<{ type: string, index?: number } | null>(null);
  
  // Référence pour maintenir la liaison avec la voix sans re-rendu intempestif
  const activeVoiceFieldRef = useRef<{ type: string, index?: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Synchronisation de la ref avec l'état UI
  useEffect(() => {
    activeVoiceFieldRef.current = activeUIField;
  }, [activeUIField]);

  const handleVoiceResult = useCallback((text: string) => {
    const target = activeVoiceFieldRef.current;
    if (!target) return;

    console.log(`🎙️ [DATASET_AUDIT] Injection voix dans [${target.type}${target.index !== undefined ? ':' + target.index : ''}] : ${text}`);

    if (target.type === 'question') {
      setQuestion(prev => prev ? `${prev} ${text}` : text);
    } else if (target.type === 'answer') {
      setAnswer(prev => prev ? `${prev} ${text}` : text);
    } else if (target.type === 'procTitle') {
      setProcTitle(prev => prev ? `${prev} ${text}` : text);
    } else if (typeof target.index === 'number') {
      setProcSteps(prev => {
        const next = [...prev];
        if (!next[target.index!]) return prev;
        const s = { ...next[target.index!] };
        if (target.type === 'stepTitle') s.title = s.title ? `${s.title} ${text}` : text;
        else if (target.type === 'stepDuration') s.duration = s.duration ? `${s.duration} ${text}` : text;
        next[target.index!] = s;
        return next;
      });
    }
  }, []);

  // Paramètres voix mémoïsés pour éviter les cycles de hooks
  const voiceOptions = useMemo(() => ({
    onResult: handleVoiceResult,
    autoRestart: true,
    lang: 'fr-FR'
  }), [handleVoiceResult]);

  const voice = useVoice(voiceOptions);

  useEffect(() => {
    if (voice.error === 'not-allowed') {
      toast({
        title: "Microphone Bloqué",
        description: "Accès refusé. Vérifiez les permissions de votre navigateur ou utilisez HTTPS.",
        variant: "destructive"
      });
    }
  }, [voice.error, toast]);

  const toggleVoice = (type: string, index?: number) => {
    const isCurrentlyActive = voice.isListening && activeUIField?.type === type && activeUIField?.index === index;

    if (isCurrentlyActive) {
      voice.stopListening();
      setActiveUIField(null);
    } else {
      voice.stopListening();
      setActiveUIField({ type, index });
      // Délai court pour assurer l'arrêt propre avant redémarrage sur une nouvelle cible
      setTimeout(() => {
        voice.startListening();
        if (isGuideActive) {
          voice.speak(type === 'question' ? "Décrivez le symptôme." : "Décrivez la résolution.");
        }
      }, 50);
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'qa') {
      if (!question.trim() || !answer.trim()) return;
      setQaItems(prev => [{ id: Date.now().toString(), type: 'qa', label: question, details: answer }, ...prev]);
      setQuestion(''); setAnswer('');
    } else {
      if (!procTitle.trim()) return;
      const details = procSteps.map((s, i) => `[ÉTAPE ${i + 1}] ${s.title} (${s.duration})`).join('\n');
      setQaItems(prev => [{ id: Date.now().toString(), type: 'procedure', label: procTitle, details }, ...prev]);
      setProcTitle('');
      setProcSteps([{ id: Date.now().toString(), title: '', duration: '' }]);
    }
    toast({ title: "Donnée ajoutée à la file d'attente." });
  };

  const handleFinalSubmit = async () => {
    if (qaItems.length === 0) return;
    setIsUploading(true);
    try {
      const items = qaItems.map(item => ({
        id: `doc-${item.id}`,
        projectId: 'project-001',
        type: 'document' as const,
        content: JSON.stringify({ label: item.label, details: item.details, type: item.type }),
        tags: [item.type],
        createdAt: new Date()
      }));
      await apiClient.post('/api/sync/upload', { userId: 'admin', projectId: 'project-001', items });
      toast({ title: "Synchronisation Réussie", description: "Le registre cloud a été mis à jour." });
      setQaItems([]);
    } catch (e) {
      toast({ title: "Échec Synchronisation", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const removeItem = (id: string) => {
    setQaItems(prev => prev.filter(i => i.id !== id));
  };

  // --- RENDU ---
  if (!mounted) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto terminal-scroll">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <Database className="w-4 h-4 text-primary" />
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Capture RAG</span>
          </div>

          <div className="flex items-center gap-4">
            {voice.error === 'not-allowed' && (
              <div className="flex items-center gap-2 text-destructive animate-pulse">
                <AlertTriangle className="w-3 h-3" />
                <span className="text-[8px] font-code uppercase">Microphone Bloqué</span>
              </div>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsGuideActive(!isGuideActive)}
              className={cn("h-9 text-[9px] font-code uppercase", isGuideActive ? "text-secondary" : "text-muted-foreground")}
            >
              <Sparkles className="w-3.5 h-3.5 mr-2" />
              Audit Guidé {isGuideActive ? "ON" : "OFF"}
            </Button>
            <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
              <button onClick={() => setMode('qa')} className={cn("px-3 py-1 text-[9px] uppercase rounded-sm", mode === 'qa' ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>FAQ</button>
              <button onClick={() => setMode('procedure')} className={cn("px-3 py-1 text-[9px] uppercase rounded-sm", mode === 'procedure' ? "bg-secondary text-secondary-foreground" : "text-muted-foreground")}>Procédure</button>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
          <Card className="p-6 border-border bg-card/50 space-y-6 rounded-sm shadow-2xl">
            <form onSubmit={handleAddItem} className="space-y-6">
              {mode === 'qa' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Textarea 
                      value={question} 
                      onChange={(e) => setQuestion(e.target.value)} 
                      placeholder="SYMPTÔME / QUESTION..." 
                      className={cn("h-32 bg-background font-code text-xs uppercase transition-all", activeUIField?.type === 'question' && "ring-2 ring-red-500 border-red-500 animate-pulse")}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('question')} className={cn("absolute top-2 right-2 h-7 w-7", activeUIField?.type === 'question' ? "text-red-500" : "text-primary")}>
                      {voice.isListening && activeUIField?.type === 'question' ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                  <div className="relative">
                    <Textarea 
                      value={answer} 
                      onChange={(e) => setAnswer(e.target.value)} 
                      placeholder="RÉSOLUTION / RÉPONSE..." 
                      className={cn("h-32 bg-background font-code text-xs uppercase transition-all", activeUIField?.type === 'answer' && "ring-2 ring-red-500 border-red-500 animate-pulse")}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('answer')} className={cn("absolute top-2 right-2 h-7 w-7", activeUIField?.type === 'answer' ? "text-red-500" : "text-primary")}>
                       {voice.isListening && activeUIField?.type === 'answer' ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Input 
                      value={procTitle} 
                      onChange={(e) => setProcTitle(e.target.value)} 
                      placeholder="TITRE DE LA PROCÉDURE" 
                      className={cn("bg-background uppercase h-12 text-sm font-bold", activeUIField?.type === 'procTitle' && "ring-2 ring-red-500 border-red-500")} 
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('procTitle')} className={cn("absolute top-2.5 right-2 h-7 w-7", activeUIField?.type === 'procTitle' ? "text-red-500" : "text-primary")}>
                      <Mic className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {procSteps.map((step, index) => (
                    <Card key={step.id} className="p-4 border-border bg-black/30 space-y-4">
                      <div className="flex justify-between items-center border-b border-border/50 pb-2">
                        <span className="text-[10px] font-bold text-secondary uppercase">Étape {index + 1}</span>
                        <div className="relative">
                          <Input 
                            placeholder="DURÉE" 
                            value={step.duration} 
                            onChange={(e) => { const n = [...procSteps]; n[index].duration = e.target.value; setProcSteps(n); }} 
                            className={cn("h-7 w-32 text-[9px] bg-background/20", activeUIField?.type === 'stepDuration' && activeUIField?.index === index && "ring-1 ring-red-500")}
                          />
                          <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepDuration', index)} className="absolute right-0 top-0 h-7 w-7"><Mic className="w-2.5 h-2.5" /></Button>
                        </div>
                      </div>
                      <div className="relative">
                        <Input 
                          placeholder="ACTION" 
                          value={step.title} 
                          onChange={(e) => { const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n); }} 
                          className={cn("h-8 text-[10px] uppercase", activeUIField?.type === 'stepTitle' && activeUIField?.index === index && "ring-1 ring-red-500")}
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepTitle', index)} className="absolute top-0.5 right-1 h-7 w-7"><Mic className="w-3 h-3" /></Button>
                      </div>
                    </Card>
                  ))}
                  <Button type="button" variant="outline" onClick={() => setProcSteps([...procSteps, { id: Date.now().toString(), title: '', duration: '' }])} className="w-full border-dashed h-10 text-[10px] uppercase">
                    <Plus className="w-3 h-3 mr-2" /> Ajouter Étape
                  </Button>
                </div>
              )}

              <Button type="submit" className="w-full font-headline font-bold uppercase text-xs h-10 bg-primary">
                Enregistrer dans la file
              </Button>
            </form>
          </Card>

          {qaItems.length > 0 && (
            <div className="space-y-3 pb-12">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5" /> File d'attente ({qaItems.length})
                </h3>
                <Button onClick={handleFinalSubmit} disabled={isUploading} size="sm" className="bg-secondary text-secondary-foreground text-[9px] uppercase font-bold">
                  {isUploading ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <UploadCloud className="w-3 h-3 mr-2" />} 
                  Pousser vers Cloud
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {qaItems.map(item => (
                  <Card key={item.id} className="p-4 border-border bg-card/20 relative group">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeItem(item.id)}
                      className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                    <p className="text-[10px] font-bold text-primary uppercase truncate pr-8 mb-1">{item.label}</p>
                    <p className="text-[9px] font-code text-muted-foreground line-clamp-2 italic">{item.details}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
