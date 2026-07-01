"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Database, 
  Plus, 
  Layers,
  Mic,
  MicOff,
  Sparkles,
  Loader2,
  Trash2,
  ChevronDown,
  Info,
  ShieldAlert,
  Image as ImageIcon,
  Video as VideoIcon,
  Camera,
  CheckCircle2,
  Volume2,
  Type,
  Clock,
  Settings2,
  AlertTriangle
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Interface locale simplifiée pour la dictée
interface DictationStep {
  id: string;
  title: string;
  duration: string;
  description: string;
  conditions: string;
  alarms: string;
}

export default function DatasetPage() {
  const { toast } = useToast();
  
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'qa' | 'procedure'>('qa');
  const [isUploading, setIsUploading] = useState(false);
  const [isAssistantActive, setIsAssistantActive] = useState(false);
  
  const [phraseBuffers, setPhraseBuffers] = useState<Record<string, string[]>>({});
  
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  
  const [procTitle, setProcTitle] = useState('');
  const [procSteps, setProcSteps] = useState<DictationStep[]>([
    { id: '1', title: '', duration: '60', description: '', conditions: '', alarms: '' }
  ]);

  const [mediaModal, setMediaModal] = useState<{ isOpen: boolean, type: 'image' | 'video', stepIndex: number | null }>({
    isOpen: false,
    type: 'image',
    stepIndex: null
  });
  const [isCapturing, setIsCapturing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [stepMediaData, setStepMediaData] = useState<Record<number, { imageData?: string; videoData?: string }>>({});
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const [activeUIField, setActiveUIField] = useState<{ type: string, index?: number } | null>(null);
  const activeVoiceFieldRef = useRef<{ type: string, index?: number } | null>(null);

  useEffect(() => {
    activeVoiceFieldRef.current = activeUIField;
  }, [activeUIField]);

  const getFieldKey = (type: string, index?: number) => index !== undefined ? `${type}-${index}` : type;

  const updateTextFromBuffer = useCallback((key: string, phrases: string[]) => {
    const fullText = phrases.join(' ');
    if (key === 'question') setQuestion(fullText);
    else if (key === 'answer') setAnswer(fullText);
    else if (key === 'procTitle') setProcTitle(fullText);
    else if (key.includes('-')) {
      const [type, idxStr] = key.split('-');
      const index = parseInt(idxStr);
      setProcSteps(prev => {
        const next = [...prev];
        if (!next[index]) return prev;
        const s = { ...next[index] };
        if (type === 'stepTitle') s.title = fullText;
        else if (type === 'stepDuration') s.duration = fullText;
        else if (type === 'stepDescription') s.description = fullText;
        else if (type === 'stepConditions') s.conditions = fullText;
        else if (type === 'stepAlarms') s.alarms = fullText;
        next[index] = s;
        return next;
      });
    }
  }, []);

  const handleVoiceResult = useCallback((text: string) => {
    const target = activeVoiceFieldRef.current;
    if (!target) return;

    const key = getFieldKey(target.type, target.index);
    const lowerText = text.toLowerCase().trim();

    if (lowerText === 'non') {
      setPhraseBuffers(prev => {
        const current = prev[key] || [];
        if (current.length === 0) return prev;
        const next = current.slice(0, -1);
        updateTextFromBuffer(key, next);
        voice.speak("Correction prise en compte.");
        return { ...prev, [key]: next };
      });
      return;
    }

    setPhraseBuffers(prev => {
      const current = prev[key] || [];
      const next = [...current, text];
      updateTextFromBuffer(key, next);
      return { ...prev, [key]: next };
    });
  }, [updateTextFromBuffer]);

  const voice = useVoice({
    onResult: handleVoiceResult,
    autoRestart: true,
    lang: 'fr-FR'
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleAssistant = () => {
    if (isAssistantActive) {
      voice.stopListening();
      setIsAssistantActive(false);
      setActiveUIField(null);
      voice.speak("Station de dictée en veille.");
    } else {
      if (!voice.isSupported) {
        toast({ title: "Incompatible", description: "Reconnaissance vocale non supportée.", variant: "destructive" });
        return;
      }
      setIsAssistantActive(true);
      voice.startListening();
      voice.speak("Station active. Dites le titre de la procédure.");
      handleFieldFocus('procTitle');
    }
  };

  const handleFieldFocus = (type: string, index?: number) => {
    setActiveUIField({ type, index });
    if (!isAssistantActive) return;
    
    let instruction = "";
    if (type === 'question') instruction = "Dites le symptôme.";
    else if (type === 'answer') instruction = "Dites la résolution.";
    else if (type === 'procTitle') instruction = "Quel est le titre ?";
    else if (type === 'stepTitle') instruction = `Action pour l'étape ${index! + 1} ?`;
    else if (type === 'stepDescription') instruction = "Détails techniques ?";

    if (instruction) voice.speak(instruction);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'qa') {
      if (!question.trim() || !answer.trim()) {
        toast({ title: "Champs requis", variant: "destructive" });
        return;
      }
      setIsUploading(true);
      try {
        const res = await fetch('/api/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'qa', title: question.slice(0, 50), question, answer }),
        });
        if (res.ok) {
          toast({ title: "Q/R enregistré et indexé" });
          setQuestion(''); setAnswer(''); setPhraseBuffers({});
        }
      } catch {
        toast({ title: "Échec indexation", variant: "destructive" });
      } finally { setIsUploading(false); }
    } else {
      if (!procTitle.trim()) {
        toast({ title: "Titre requis", variant: "destructive" });
        return;
      }
      setIsUploading(true);
      try {
        const formattedSteps = procSteps.map((s, i) => ({
          id: `step-${Date.now()}-${i}`,
          order: i + 1,
          title: s.title || `Action ${i + 1}`,
          description: s.description || "Instruction technique",
          duration: { value: parseInt(s.duration) || 60, unit: "seconds", display: `${s.duration}s`, type: "fixed" },
          action: { type: "confirmation", instruction: s.description, ui: { component: "action_button", label: "Confirmer", icon: "check" } },
          validation: {
            conditions: s.conditions ? [{ id: `val-${i}`, description: s.conditions, type: "status", operator: "==", value: "OK", displayName: "Validation" }] : [],
            successExpression: "status == OK",
            timeout: { value: 300, unit: "seconds", action: "warn" }
          },
          dependencies: { prerequisites: [], dependsOn: [], requiresConfirmation: true }
        }));

        const res = await fetch('/api/procedures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            title: procTitle, 
            steps: formattedSteps,
            metadata: { category: "MAINTENANCE", department: "PRODUCTION", criticality: "MEDIUM", version: "1.0.0" }
          }),
        });

        const data = await res.json();
        if (data.success) {
          toast({ title: "Procédure forgée", description: "L'actif est prêt dans le registre." });
          setProcTitle('');
          setProcSteps([{ id: '1', title: '', duration: '60', description: '', conditions: '', alarms: '' }]);
          setPhraseBuffers({});
          if (isAssistantActive) voice.speak("Procédure enregistrée.");
        } else {
          throw new Error(data.message);
        }
      } catch (err: any) {
        toast({ title: "Échec de la forge", description: err.message, variant: "destructive" });
      } finally { setIsUploading(false); }
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
            <Database className="w-4 h-4 text-primary" />
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Station de Dictée Industrielle</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={toggleAssistant} className={cn("h-9 text-[9px] font-code uppercase transition-all", isAssistantActive ? "bg-primary/20 border-primary text-primary animate-pulse" : "text-muted-foreground")}>
              {isAssistantActive ? <Sparkles className="w-3.5 h-3.5 mr-2" /> : <Mic className="w-3.5 h-3.5 mr-2" />}
              Assistant {isAssistantActive ? "ACTIF" : "VEILLE"}
            </Button>
            <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
              <button onClick={() => setMode('qa')} className={cn("px-3 py-1 text-[9px] uppercase rounded-sm", mode === 'qa' ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground")}>FAQ</button>
              <button onClick={() => setMode('procedure')} className={cn("px-3 py-1 text-[9px] uppercase rounded-sm", mode === 'procedure' ? "bg-secondary text-secondary-foreground font-bold" : "text-muted-foreground")}>Procédure</button>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-5xl mx-auto w-full space-y-8">
          <Card className="p-6 border-border bg-card/50 space-y-6 rounded-sm shadow-2xl relative overflow-hidden">
            <form onSubmit={handleAddItem} className="space-y-6">
              {mode === 'qa' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <p className="text-[10px] font-bold text-primary mb-2 uppercase tracking-widest">Symptôme / Question</p>
                    <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} onFocus={() => handleFieldFocus('question')} placeholder="EX: ÉCHAUFFEMENT POMPE CRF..." className={cn("h-32 bg-background font-code text-xs uppercase transition-all", activeUIField?.type === 'question' && "ring-2 ring-primary border-primary")} />
                  </div>
                  <div className="relative">
                    <p className="text-[10px] font-bold text-secondary mb-2 uppercase tracking-widest">Résolution / Réponse</p>
                    <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} onFocus={() => handleFieldFocus('answer')} placeholder="EX: VÉRIFIER CIRCUIT DE LUBRIFICATION..." className={cn("h-32 bg-background font-code text-xs uppercase transition-all", activeUIField?.type === 'answer' && "ring-2 ring-secondary border-secondary")} />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="relative">
                    <label className="text-[10px] font-bold text-primary uppercase tracking-widest block mb-2">Titre de la procédure</label>
                    <Input value={procTitle} onChange={(e) => setProcTitle(e.target.value)} onFocus={() => handleFieldFocus('procTitle')} placeholder="EX: DÉMARRAGE POMPE CRF..." className={cn("bg-background uppercase h-12 text-sm font-bold transition-all border-primary/20", activeUIField?.type === 'procTitle' && "ring-2 ring-primary")} />
                  </div>
                  <div className="space-y-6">
                    {procSteps.map((step, index) => (
                      <Card key={index} className="p-4 border-border bg-black/30 space-y-4">
                        <div className="flex justify-between items-center border-b border-border/50 pb-2">
                          <span className="text-[10px] font-bold text-secondary uppercase">Séquence {index + 1}</span>
                          <div className="flex items-center gap-2">
                             <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                             <Input value={step.duration} onChange={(e) => { const n = [...procSteps]; n[index].duration = e.target.value; setProcSteps(n); }} className="h-7 w-16 text-[10px] font-code text-center" />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input placeholder="Titre de l'action..." value={step.title} onFocus={() => handleFieldFocus('stepTitle', index)} onChange={(e) => { const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n); }} className="h-9 text-[10px] uppercase" />
                          <Input placeholder="Instructions techniques..." value={step.description} onFocus={() => handleFieldFocus('stepDescription', index)} onChange={(e) => { const n = [...procSteps]; n[index].description = e.target.value; setProcSteps(n); }} className="h-9 text-[10px] uppercase" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input placeholder="Conditions de validation..." value={step.conditions} onChange={(e) => { const n = [...procSteps]; n[index].conditions = e.target.value; setProcSteps(n); }} className="h-9 text-[10px] uppercase bg-primary/5" />
                          <Input placeholder="Alarmes & Risques..." value={step.alarms} onChange={(e) => { const n = [...procSteps]; n[index].alarms = e.target.value; setProcSteps(n); }} className="h-9 text-[10px] uppercase bg-destructive/5" />
                        </div>
                      </Card>
                    ))}
                  </div>
                  <Button type="button" variant="outline" onClick={() => setProcSteps([...procSteps, { id: Date.now().toString(), title: '', duration: '60', description: '', conditions: '', alarms: '' }])} className="w-full border-dashed h-10 text-[9px] uppercase font-bold">
                    <Plus className="w-3.5 h-3.5 mr-2" /> Ajouter une séquence
                  </Button>
                </div>
              )}
              <div className="pt-6">
                <Button type="submit" disabled={isUploading} className={cn("w-full font-headline font-bold uppercase text-xs h-14 shadow-2xl", mode === 'qa' ? "bg-primary" : "bg-secondary")}>
                  {isUploading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                  {mode === 'qa' ? "Enregistrer dans la file sémantique" : "Forger la Procédure et Indexer"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
}
