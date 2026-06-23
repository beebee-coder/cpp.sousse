"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Database, 
  Plus, 
  Trash2, 
  UploadCloud, 
  Layers,
  Camera,
  Video,
  RefreshCw,
  Loader2,
  Mic,
  MicOff,
  Activity,
  ShieldAlert,
  Bell,
  Clock,
  Sparkles
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent 
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { usePlatform } from '@/components/PlatformProvider';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { useVoice } from '@/hooks/use-voice';
import { cn } from '@/lib/utils';

interface ProcedureStep {
  id: string;
  title: string;
  description: string;
  normalConditions: string;
  abnormalConditions: string;
  alarms: string;
  duration: string;
  imageFile?: File;
  videoFile?: File;
  imagePreview?: string;
  videoPreview?: string;
}

interface QAItem {
  id: string;
  type: 'qa' | 'procedure';
  label: string;
  details: string;
}

export default function DatasetPage() {
  const { toast } = useToast();
  const { isDesktop } = usePlatform();
  const [mounted, setMounted] = useState(false);
  
  const [mode, setMode] = useState<'qa' | 'procedure'>('qa');
  const [qaItems, setQaItems] = useState<QAItem[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const [procTitle, setProcTitle] = useState('');
  const [procSteps, setProcSteps] = useState<ProcedureStep[]>([
    { id: '1', title: '', description: '', normalConditions: '', abnormalConditions: '', alarms: '', duration: '' }
  ]);

  const [isUploading, setIsUploading] = useState(false);
  const [isGuideActive, setIsGuideActive] = useState(false);
  
  // Utilisation d'une référence immuable pour le routage de la voix
  const activeVoiceFieldRef = useRef<{ type: string, index?: number } | null>(null);
  const [activeVoiceField, setActiveVoiceField] = useState<{ type: string, index?: number } | null>(null);

  const handleVoiceResult = useCallback((text: string) => {
    const target = activeVoiceFieldRef.current;
    if (!target) {
      console.warn(`[DATASET_AUDIT] ⚠️ Aucun champ cible identifié pour : "${text}"`);
      return;
    }

    const cleanText = text.trim();
    console.log(`[DATASET_AUDIT] 🎯 Injection vers [${target.type}] ${target.index ?? ''} : "${cleanText}"`);

    if (target.type === 'question') {
      setQuestion(prev => prev ? `${prev} ${cleanText}` : cleanText);
    } else if (target.type === 'answer') {
      setAnswer(prev => prev ? `${prev} ${cleanText}` : cleanText);
    } else if (target.type === 'procTitle') {
      setProcTitle(prev => prev ? `${prev} ${cleanText}` : cleanText);
    } else if (typeof target.index === 'number') {
      setProcSteps(prev => {
        const next = [...prev];
        const s = { ...next[target.index!] };
        if (target.type === 'stepTitle') s.title = s.title ? `${s.title} ${cleanText}` : cleanText;
        else if (target.type === 'stepDesc') s.description = s.description ? `${s.description} ${cleanText}` : cleanText;
        else if (target.type === 'stepNormal') s.normalConditions = s.normalConditions ? `${s.normalConditions} ${cleanText}` : cleanText;
        else if (target.type === 'stepAbnormal') s.abnormalConditions = s.abnormalConditions ? `${s.abnormalConditions} ${cleanText}` : cleanText;
        else if (target.type === 'stepAlarms') s.alarms = s.alarms ? `${s.alarms} ${cleanText}` : cleanText;
        else if (target.type === 'stepDuration') s.duration = s.duration ? `${s.duration} ${cleanText}` : cleanText;
        next[target.index!] = s;
        return next;
      });
    }
  }, []);

  const { isListening, isSupported, startListening, stopListening, speak } = useVoice({
    onResult: handleVoiceResult,
    autoRestart: true,
    continuous: true
  });

  const toggleVoice = (type: string, index?: number) => {
    const target = { type, index };
    const isCurrentlyActive = isListening && activeVoiceField?.type === type && activeVoiceField?.index === index;

    if (isCurrentlyActive) {
      console.log(`[DATASET_AUDIT] 🛑 Arrêt micro pour ${type}`);
      stopListening();
      activeVoiceFieldRef.current = null;
      setActiveVoiceField(null);
    } else {
      console.log(`[DATASET_AUDIT] 🎙️ Activation micro pour ${type}`);
      if (isListening) stopListening();
      
      activeVoiceFieldRef.current = target;
      setActiveVoiceField(target);

      // Petit délai pour laisser le temps au moteur de redémarrer proprement
      setTimeout(() => {
        startListening();
        if (isGuideActive) {
          const guideMsg = type === 'question' ? "Décrivez le symptôme observé." : 
                           type === 'answer' ? "Indiquez la méthode de résolution." : 
                           "Complétez ce champ de procédure.";
          speak(guideMsg);
        }
      }, 100);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'qa') {
      if (!question.trim() || !answer.trim()) return;
      setQaItems([{ id: Date.now().toString(), type: 'qa', label: question, details: answer }, ...qaItems]);
      setQuestion(''); setAnswer('');
    } else {
      if (!procTitle.trim()) return;
      const details = procSteps.map((s, i) => `[ÉTAPE ${i + 1}] ${s.title}\nDurée: ${s.duration || 'Indéfinie'}\nDesc: ${s.description}`).join('\n');
      setQaItems([{ id: Date.now().toString(), type: 'procedure', label: procTitle, details }, ...qaItems]);
      setProcTitle('');
      setProcSteps([{ id: Date.now().toString(), title: '', description: '', normalConditions: '', abnormalConditions: '', alarms: '', duration: '' }]);
    }
    toast({ title: "Ajouté", description: "L'élément est dans la file d'attente locale." });
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
      toast({ title: "Synchronisation Réussie", description: `${items.length} éléments envoyés au registre.` });
      setQaItems([]);
    } catch (e) {
      toast({ title: "Échec Synchronisation", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto terminal-scroll">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <Database className="w-4 h-4 text-primary animate-pulse" />
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Base d'Entraînement RAG</span>
          </div>

          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setIsGuideActive(!isGuideActive);
                if (!isGuideActive) speak("Assistant de saisie vocale activé.");
              }}
              className={cn("h-9 text-[9px] font-code uppercase", isGuideActive ? "text-secondary" : "text-muted-foreground")}
            >
              <Sparkles className="w-3.5 h-3.5 mr-2" />
              {isGuideActive ? "Guide Vocal ON" : "Guide Vocal OFF"}
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
                  <div className="relative group">
                    <Textarea 
                      value={question} 
                      onChange={(e) => setQuestion(e.target.value)} 
                      placeholder="SYMPTÔME / QUESTION..." 
                      className={cn(
                        "h-32 bg-background font-code text-xs uppercase pr-10 transition-all", 
                        activeVoiceField?.type === 'question' && "ring-2 ring-red-500 animate-pulse border-red-500"
                      )}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('question')} className={cn("absolute top-2 right-2 h-7 w-7", activeVoiceField?.type === 'question' ? "text-red-500" : "text-primary")}>
                      {activeVoiceField?.type === 'question' && isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                  <div className="relative group">
                    <Textarea 
                      value={answer} 
                      onChange={(e) => setAnswer(e.target.value)} 
                      placeholder="RÉSOLUTION / RÉPONSE..." 
                      className={cn(
                        "h-32 bg-background font-code text-xs uppercase pr-10 transition-all", 
                        activeVoiceField?.type === 'answer' && "ring-2 ring-red-500 animate-pulse border-red-500"
                      )}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('answer')} className={cn("absolute top-2 right-2 h-7 w-7", activeVoiceField?.type === 'answer' ? "text-red-500" : "text-primary")}>
                      {activeVoiceField?.type === 'answer' && isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative group">
                    <Input 
                      value={procTitle} 
                      onChange={(e) => setProcTitle(e.target.value)} 
                      placeholder="TITRE DE LA PROCÉDURE INDUSTRIELLE" 
                      className={cn(
                        "bg-background uppercase h-12 text-sm font-bold tracking-widest", 
                        activeVoiceField?.type === 'procTitle' && "ring-2 ring-red-500 animate-pulse border-red-500"
                      )} 
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('procTitle')} className={cn("absolute top-2.5 right-2 h-7 w-7", activeVoiceField?.type === 'procTitle' ? "text-red-500" : "text-primary")}>
                      {activeVoiceField?.type === 'procTitle' && isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </Button>
                  </div>

                  {procSteps.map((step, index) => (
                    <Card key={step.id} className="p-4 border-border bg-black/30 space-y-4 relative group">
                      <div className="flex justify-between items-center border-b border-border/50 pb-2">
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-bold text-secondary tracking-widest uppercase">Étape {index + 1}</span>
                          <div className="relative">
                            <Input 
                              placeholder="TEMPS ESTIMÉ..." 
                              value={step.duration} 
                              onChange={(e) => { const n = [...procSteps]; n[index].duration = e.target.value; setProcSteps(n); }} 
                              className={cn(
                                "h-7 w-36 text-[9px] bg-background/20 font-code uppercase", 
                                activeVoiceField?.type === 'stepDuration' && activeVoiceField?.index === index && "ring-1 ring-red-500"
                              )}
                            />
                            <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepDuration', index)} className="absolute right-0 top-0 h-7 w-7 text-muted-foreground"><Mic className="w-2.5 h-2.5" /></Button>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setProcSteps(procSteps.filter(s => s.id !== step.id))}><Trash2 className="w-3 h-3" /></Button>
                      </div>

                      <div className="space-y-4">
                        <div className="relative group">
                          <Input 
                            placeholder="ACTION À RÉALISER" 
                            value={step.title} 
                            onChange={(e) => { const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n); }} 
                            className={cn("h-9 text-[11px] uppercase bg-background", activeVoiceField?.type === 'stepTitle' && activeVoiceField?.index === index && "ring-2 ring-red-500")}
                          />
                          <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepTitle', index)} className="absolute top-1 right-2 h-7 w-7"><Mic className="w-3.5 h-3.5" /></Button>
                        </div>

                        <div className="relative group">
                          <Textarea 
                            placeholder="DESCRIPTION DÉTAILLÉE DU MODE OPÉRATOIRE..." 
                            value={step.description} 
                            onChange={(e) => { const n = [...procSteps]; n[index].description = e.target.value; setProcSteps(n); }} 
                            className={cn("h-20 bg-background/50 font-code text-[11px] uppercase", activeVoiceField?.type === 'stepDesc' && activeVoiceField?.index === index && "ring-2 ring-red-500")}
                          />
                          <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepDesc', index)} className="absolute top-2 right-2 h-7 w-7"><Mic className="w-3.5 h-3.5" /></Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1 relative">
                            <span className="text-[8px] font-bold text-secondary uppercase tracking-tighter">Conditions Nominales</span>
                            <Input value={step.normalConditions} onChange={(e) => { const n = [...procSteps]; n[index].normalConditions = e.target.value; setProcSteps(n); }} className={cn("h-7 text-[9px] bg-background", activeVoiceField?.type === 'stepNormal' && activeVoiceField?.index === index && "ring-1 ring-red-500")} />
                            <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepNormal', index)} className="absolute bottom-0 right-0 h-7 w-7"><Mic className="w-2.5 h-2.5" /></Button>
                          </div>
                          <div className="space-y-1 relative">
                            <span className="text-[8px] font-bold text-primary uppercase tracking-tighter">Dérives Anormales</span>
                            <Input value={step.abnormalConditions} onChange={(e) => { const n = [...procSteps]; n[index].abnormalConditions = e.target.value; setProcSteps(n); }} className={cn("h-7 text-[9px] bg-background", activeVoiceField?.type === 'stepAbnormal' && activeVoiceField?.index === index && "ring-1 ring-red-500")} />
                            <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepAbnormal', index)} className="absolute bottom-0 right-0 h-7 w-7"><Mic className="w-2.5 h-2.5" /></Button>
                          </div>
                          <div className="space-y-1 relative">
                            <span className="text-[8px] font-bold text-destructive uppercase tracking-tighter">Seuils d'Alarme</span>
                            <Input value={step.alarms} onChange={(e) => { const n = [...procSteps]; n[index].alarms = e.target.value; setProcSteps(n); }} className={cn("h-7 text-[9px] bg-background", activeVoiceField?.type === 'stepAlarms' && activeVoiceField?.index === index && "ring-1 ring-red-500")} />
                            <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepAlarms', index)} className="absolute bottom-0 right-0 h-7 w-7"><Mic className="w-2.5 h-2.5" /></Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                  <Button type="button" variant="outline" onClick={() => setProcSteps([...procSteps, { id: Date.now().toString(), title: '', description: '', normalConditions: '', abnormalConditions: '', alarms: '', duration: '' }])} className="w-full border-dashed h-10 text-[10px] uppercase font-code hover:bg-primary/5 transition-colors">
                    <Plus className="w-4 h-4 mr-2" /> Ajouter une étape à la procédure
                  </Button>
                </div>
              )}

              <div className="flex justify-end pt-6 border-t border-border/50">
                <Button type="submit" size="lg" className="font-headline font-bold uppercase text-xs h-12 px-10 bg-primary shadow-xl hover:scale-105 active:scale-95 transition-all">
                  Valider l'élément pour le RAG
                </Button>
              </div>
            </form>
          </Card>

          {qaItems.length > 0 && (
            <div className="space-y-4 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" /> 
                  Éléments en attente ({qaItems.length})
                </h3>
                <Button onClick={handleFinalSubmit} disabled={isUploading} className="bg-secondary text-secondary-foreground text-[10px] uppercase font-bold h-9 px-6 shadow-lg">
                  {isUploading ? <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5 mr-2" />} 
                  Pousser vers le Cloud
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {qaItems.map((item) => (
                  <Card key={item.id} className="p-3 border-border bg-black/40 font-code text-[9px] flex justify-between items-center rounded-sm group hover:border-primary/50 transition-colors">
                    <div className="truncate flex items-center gap-3">
                      <Badge variant={item.type === 'qa' ? 'default' : 'secondary'} className="text-[8px] py-0 px-1.5 uppercase font-bold">
                        {item.type}
                      </Badge>
                      <span className="text-muted-foreground uppercase truncate max-w-md">{item.label}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setQaItems(qaItems.filter(i => i.id !== item.id))} className="h-7 w-7 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
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
