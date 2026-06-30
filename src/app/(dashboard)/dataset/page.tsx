"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
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
  Trash2,
  ChevronDown,
  Info,
  ShieldAlert,
  Image as ImageIcon,
  Video as VideoIcon,
  Bell,
  Camera,
  StopCircle,
  CheckCircle2,
  X,
  Volume2,
  Undo2
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface ProcedureStep {
  id: string;
  title: string;
  duration: string;
  description: string;
  conditions: string;
  alarms: string;
  imageRef?: string;
  videoRef?: string;
}

interface QAItem {
  id: string;
  type: 'qa' | 'procedure';
  label: string;
  details: string;
}

export default function DatasetPage() {
  const { toast } = useToast();
  
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'qa' | 'procedure'>('qa');
  const [qaItems, setQaItems] = useState<QAItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isAssistantActive, setIsAssistantActive] = useState(false);
  
  // Buffers de phrases pour la correction intelligente
  const [phraseBuffers, setPhraseBuffers] = useState<Record<string, string[]>>({});
  
  // Form States (QA)
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  
  // Form States (Procedure)
  const [procTitle, setProcTitle] = useState('');
  const [procSteps, setProcSteps] = useState<ProcedureStep[]>([
    { id: '1', title: '', duration: '', description: '', conditions: '', alarms: '' }
  ]);

  // Media States
  const [mediaModal, setMediaModal] = useState<{ isOpen: boolean, type: 'image' | 'video', stepIndex: number | null }>({
    isOpen: false,
    type: 'image',
    stepIndex: null
  });
  const [isCapturing, setIsCapturing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  // Stockage des médias capturés par étape (clé: index, valeur: {imageData?, videoData?})
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

  // Helper pour obtenir la clé unique du champ (ex: "stepTitle-0")
  const getFieldKey = (type: string, index?: number) => index !== undefined ? `${type}-${index}` : type;

  // Mise à jour de l'état textuel à partir des buffers de phrases
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

    // Logique de correction intelligente "Non"
    if (lowerText === 'non') {
      setPhraseBuffers(prev => {
        const current = prev[key] || [];
        if (current.length === 0) return prev;
        const next = current.slice(0, -1);
        updateTextFromBuffer(key, next);
        voice.speak("Dernière phrase annulée. Vous pouvez reprendre.");
        return { ...prev, [key]: next };
      });
      return;
    }

    // Ajout d'une nouvelle phrase validée
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

  // -- LOGIQUE MÉTIER --

  const toggleAssistant = () => {
    if (isAssistantActive) {
      voice.stopListening();
      setIsAssistantActive(false);
      setActiveUIField(null);
      voice.speak("Assistant vocal désactivé.");
    } else {
      setIsAssistantActive(true);
      voice.startListening();
      voice.speak("Assistant vocal activé. Je vous guiderai à chaque champ. Dites Non pour corriger la dernière phrase.");
    }
  };

  const handleFieldFocus = (type: string, index?: number) => {
    if (!isAssistantActive) return;
    
    setActiveUIField({ type, index });
    
    // Déterminer l'instruction TTS
    let instruction = "";
    if (type === 'question') instruction = "Veuillez dicter le symptôme ou la question.";
    else if (type === 'answer') instruction = "Dictez la résolution technique.";
    else if (type === 'procTitle') instruction = "Donnez un titre à cette procédure.";
    else if (type === 'stepTitle') instruction = `Action pour l'étape ${index! + 1}.`;
    else if (type === 'stepDescription') instruction = "Ajoutez des détails sur l'opération.";
    else if (type === 'stepConditions') instruction = "Quelles sont les conditions de sécurité ?";
    else if (type === 'stepAlarms') instruction = "Y a-t-il des points de vigilance ou des alarmes ?";

    voice.speak(instruction);
    if (!voice.isListening) {
      voice.startListening();
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'qa') {
      if (!question.trim() || !answer.trim()) {
        toast({ title: "Champs requis", description: "Veuillez remplir la question et la réponse.", variant: "destructive" });
        return;
      }
      setQaItems(prev => [{ id: Date.now().toString(), type: 'qa', label: question, details: answer }, ...prev]);
      setQuestion(''); setAnswer(''); setPhraseBuffers({});
      toast({ title: "Donnée enregistrée localement." });
      if (isAssistantActive) voice.speak("Donnée ajoutée au registre provisoire.");
    } else {
      if (!procTitle.trim()) {
        toast({ title: "Titre requis", description: "Veuillez donner un titre à la procédure.", variant: "destructive" });
        return;
      }
      setIsUploading(true);
      try {
        const stepsWithMedia = procSteps.map((s, i) => ({
          ...s,
          imageData: stepMediaData[i]?.imageData ?? null,
          videoData: stepMediaData[i]?.videoData ?? null,
        }));

        const response = await fetch('/api/procedures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: procTitle,
            steps: stepsWithMedia,
            createdAt: new Date().toISOString(),
          }),
        });

        const contentType = response.headers.get('content-type');
        if (!response.ok || !contentType || !contentType.includes('application/json')) {
           const errorText = await response.text();
           throw new Error(errorText || `Erreur HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
          toast({ 
            title: `Procédure sauvegardée`, 
            description: `Registre mis à jour avec ${result.mediaCount} média(s).` 
          });
          setProcTitle('');
          setProcSteps([{ id: Date.now().toString(), title: '', duration: '', description: '', conditions: '', alarms: '' }]);
          setPhraseBuffers({});
          setStepMediaData({});
          if (isAssistantActive) voice.speak("Procédure enregistrée avec succès.");
        } else {
          throw new Error(result.message || "Erreur lors de la sauvegarde.");
        }
      } catch (err: any) {
        toast({ 
          title: "Échec de l'enregistrement", 
          description: err.message.includes('large') ? "Le contenu est trop lourd (vidéos trop longues)." : err.message, 
          variant: "destructive" 
        });
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleFinalSubmit = async () => {
    if (qaItems.length === 0) return;
    setIsUploading(true);
    try {
      const items = qaItems.map(item => ({
        id: `audit-${item.id}`,
        projectId: 'project-001',
        type: 'document' as const,
        content: JSON.stringify({ label: item.label, details: item.details, title: item.label, type: item.type }),
        tags: [item.type, 'intelligent_voice_input'],
        createdAt: new Date()
      }));
      await apiClient.post('/api/sync/upload', { userId: 'admin', projectId: 'project-001', items });
      toast({ title: "Synchronisation Cloud Terminée" });
      setQaItems([]);
      if (isAssistantActive) voice.speak("Synchronisation terminée. Le registre a été mis à jour.");
    } catch (e) {
      toast({ title: "Échec Synchronisation", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  // Gestion du flux caméra
  useEffect(() => {
    if (!mediaModal.isOpen) return;
    const startStream = async () => {
      if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
      if (!navigator.mediaDevices?.getUserMedia) {
        toast({ title: "Erreur Caméra", description: "L'accès caméra n'est pas disponible.", variant: "destructive" });
        setMediaModal(prev => ({ ...prev, isOpen: false }));
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 }, audio: mediaModal.type === 'video' });
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (err) {
        toast({ title: "Erreur Caméra", description: "Vérifiez les permissions de votre navigateur.", variant: "destructive" });
        setMediaModal(prev => ({ ...prev, isOpen: false }));
      }
    };
    startStream();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, [mediaModal.isOpen, mediaModal.type, toast]);

  if (!mounted) return null;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto terminal-scroll">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <Database className="w-4 h-4 text-primary" />
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Station de Dictée RAG</span>
          </div>

          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={toggleAssistant}
              className={cn(
                "h-9 text-[9px] font-code uppercase transition-all", 
                isAssistantActive ? "bg-primary/20 border-primary text-primary animate-pulse shadow-[0_0_15px_rgba(50,181,212,0.3)]" : "text-muted-foreground"
              )}
            >
              {isAssistantActive ? <Sparkles className="w-3.5 h-3.5 mr-2" /> : <Mic className="w-3.5 h-3.5 mr-2" />}
              Assistant Vocal {isAssistantActive ? "ACTIF" : "OFF"}
            </Button>
            <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
              <button onClick={() => setMode('qa')} className={cn("px-3 py-1 text-[9px] uppercase rounded-sm", mode === 'qa' ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground")}>FAQ</button>
              <button onClick={() => setMode('procedure')} className={cn("px-3 py-1 text-[9px] uppercase rounded-sm", mode === 'procedure' ? "bg-secondary text-secondary-foreground font-bold" : "text-muted-foreground")}>Procédure</button>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-5xl mx-auto w-full space-y-8">
          {isAssistantActive && (
            <div className="flex items-center gap-4 p-3 bg-black/40 border border-primary/20 rounded-sm">
               <Volume2 className="w-4 h-4 text-primary" />
               <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden flex items-center">
                  <div 
                    className="h-full bg-primary transition-all duration-75 shadow-[0_0_10px_rgba(50,181,212,0.5)]" 
                    style={{ width: `${Math.min(voice.volume * 100, 100)}%` }} 
                  />
               </div>
               <span className="text-[9px] font-code text-primary uppercase">Signal Entrant</span>
            </div>
          )}

          <Card className="p-6 border-border bg-card/50 space-y-6 rounded-sm shadow-2xl relative overflow-hidden">
            {isAssistantActive && voice.isListening && (
              <div className="absolute top-2 right-2 flex items-center gap-2 px-2 py-1 bg-red-600/20 border border-red-600/50 rounded-sm">
                 <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-ping" />
                 <span className="text-[8px] font-bold text-red-600 uppercase">Écoute active</span>
              </div>
            )}

            <form onSubmit={handleAddItem} className="space-y-6">
              {mode === 'qa' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative group">
                    <p className="text-[10px] font-bold text-primary mb-2 uppercase tracking-widest">Symptôme / Question</p>
                    <Textarea 
                      value={question} 
                      onChange={(e) => { setQuestion(e.target.value); setPhraseBuffers(prev => ({...prev, question: [e.target.value]})); }} 
                      onFocus={() => handleFieldFocus('question')}
                      placeholder="EX: ÉCHAUFFEMENT POMPE P-101..." 
                      className={cn(
                        "h-32 bg-background font-code text-xs uppercase transition-all", 
                        activeUIField?.type === 'question' && "ring-2 ring-primary border-primary shadow-[0_0_20px_rgba(50,181,212,0.15)]"
                      )}
                    />
                    <div className="absolute bottom-2 right-2 flex gap-1">
                      {phraseBuffers['question']?.length > 0 && <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground"><Undo2 className="w-3 h-3"/></Button>}
                      <Mic className={cn("w-4 h-4", activeUIField?.type === 'question' ? "text-primary animate-bounce" : "text-muted-foreground/30")} />
                    </div>
                  </div>
                  <div className="relative">
                    <p className="text-[10px] font-bold text-secondary mb-2 uppercase tracking-widest">Résolution / Réponse</p>
                    <Textarea 
                      value={answer} 
                      onChange={(e) => { setAnswer(e.target.value); setPhraseBuffers(prev => ({...prev, answer: [e.target.value]})); }} 
                      onFocus={() => handleFieldFocus('answer')}
                      placeholder="EX: VÉRIFIER LUBRIFICATION PALIER 2..." 
                      className={cn(
                        "h-32 bg-background font-code text-xs uppercase transition-all", 
                        activeUIField?.type === 'answer' && "ring-2 ring-secondary border-secondary shadow-[0_0_20px_rgba(46,184,146,0.15)]"
                      )}
                    />
                    <div className="absolute bottom-2 right-2">
                       <Mic className={cn("w-4 h-4", activeUIField?.type === 'answer' ? "text-secondary animate-bounce" : "text-muted-foreground/30")} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="relative">
                    <p className="text-[10px] font-bold text-primary mb-2 uppercase tracking-widest">Titre de la procédure industrielle</p>
                    <Input 
                      value={procTitle} 
                      onChange={(e) => { setProcTitle(e.target.value); setPhraseBuffers(prev => ({...prev, procTitle: [e.target.value]})); }} 
                      onFocus={() => handleFieldFocus('procTitle')}
                      placeholder="MAINTENANCE CURATIVE UNITÉ A-4..." 
                      className={cn("bg-background uppercase h-12 text-sm font-bold", activeUIField?.type === 'procTitle' && "ring-2 ring-primary")} 
                    />
                  </div>

                  <div className="space-y-4">
                    {procSteps.map((step, index) => (
                      <Card key={step.id} className="p-4 border-border bg-black/30 space-y-4 group">
                        <div className="flex justify-between items-center border-b border-border/50 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-secondary uppercase">Étape {index + 1}</span>
                            <Button type="button" variant="ghost" size="icon" onClick={() => setProcSteps(prev => prev.filter(s => s.id !== step.id))} className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity" disabled={procSteps.length <= 1}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <Input 
                            placeholder="DURÉE" 
                            value={step.duration} 
                            onFocus={() => handleFieldFocus('stepDuration', index)}
                            onChange={(e) => { const n = [...procSteps]; n[index].duration = e.target.value; setProcSteps(n); setPhraseBuffers(prev => ({...prev, [`stepDuration-${index}`]: [e.target.value]})); }} 
                            className="h-7 w-24 text-[9px] uppercase"
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input 
                            placeholder="ACTION..." 
                            value={step.title} 
                            onFocus={() => handleFieldFocus('stepTitle', index)}
                            onChange={(e) => { const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n); setPhraseBuffers(prev => ({...prev, [`stepTitle-${index}`]: [e.target.value]})); }} 
                            className={cn("h-8 text-[10px] uppercase", activeUIField?.type === 'stepTitle' && activeUIField?.index === index && "ring-1 ring-secondary")}
                          />
                          <Input 
                            placeholder="DÉTAILS OPÉRATIONNELS..." 
                            value={step.description} 
                            onFocus={() => handleFieldFocus('stepDescription', index)}
                            onChange={(e) => { const n = [...procSteps]; n[index].description = e.target.value; setProcSteps(n); setPhraseBuffers(prev => ({...prev, [`stepDescription-${index}`]: [e.target.value]})); }} 
                            className={cn("h-8 text-[10px] uppercase", activeUIField?.type === 'stepDescription' && activeUIField?.index === index && "ring-1 ring-secondary")}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5"><ShieldAlert className="w-3 h-3 text-primary" /><p className="text-[8px] font-bold uppercase text-primary">Conditions</p></div>
                            <Input 
                              placeholder="ÉQUIPEMENTS / SÉCURITÉ..." 
                              value={step.conditions} 
                              onFocus={() => handleFieldFocus('stepConditions', index)}
                              onChange={(e) => { const n = [...procSteps]; n[index].conditions = e.target.value; setProcSteps(n); setPhraseBuffers(prev => ({...prev, [`stepConditions-${index}`]: [e.target.value]})); }} 
                              className="h-8 text-[9px] uppercase"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5"><Bell className="w-3 h-3 text-destructive" /><p className="text-[8px] font-bold uppercase text-destructive">Vigilance</p></div>
                            <Input 
                              placeholder="ALARMES / DANGERS..." 
                              value={step.alarms} 
                              onFocus={() => handleFieldFocus('stepAlarms', index)}
                              onChange={(e) => { const n = [...procSteps]; n[index].alarms = e.target.value; setProcSteps(n); setPhraseBuffers(prev => ({...prev, [`stepAlarms-${index}`]: [e.target.value]})); }} 
                              className="h-8 text-[9px] uppercase"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                           <Button type="button" variant="secondary" size="sm" onClick={() => setMediaModal({ isOpen: true, type: 'image', stepIndex: index })} className={cn("h-7 text-[8px] uppercase font-bold flex-1 transition-all", stepMediaData[index]?.imageData ? "bg-secondary/80 border-secondary ring-1 ring-secondary" : "")}>
                             {stepMediaData[index]?.imageData ? <CheckCircle2 className="w-3 h-3 mr-2 text-secondary-foreground" /> : <Camera className="w-3 h-3 mr-2" />}
                             {stepMediaData[index]?.imageData ? 'Image OK' : 'Capture Image'}
                           </Button>
                           <Button type="button" variant="outline" size="sm" onClick={() => setMediaModal({ isOpen: true, type: 'video', stepIndex: index })} className={cn("h-7 text-[8px] uppercase font-bold flex-1 transition-all", stepMediaData[index]?.videoData ? "border-secondary text-secondary ring-1 ring-secondary" : "")}>
                             {stepMediaData[index]?.videoData ? <CheckCircle2 className="w-3 h-3 mr-2" /> : <VideoIcon className="w-3 h-3 mr-2" />}
                             {stepMediaData[index]?.videoData ? 'Vidéo OK' : 'Séquence Vidéo'}
                           </Button>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <Button type="button" variant="ghost" onClick={() => setProcSteps([...procSteps, { id: Date.now().toString(), title: '', duration: '', description: '', conditions: '', alarms: '' }])} className="w-full border border-dashed border-border h-10 text-[9px] uppercase hover:bg-secondary/10 hover:border-secondary/50 text-muted-foreground hover:text-secondary transition-all">
                    <Plus className="w-3.5 h-3.5 mr-2" /> Ajouter une étape de procédure
                  </Button>
                </div>
              )}

              <Button 
                type="submit" 
                disabled={isUploading}
                className={cn(
                  "w-full font-headline font-bold uppercase text-xs h-12 shadow-xl transition-all active:scale-95", 
                  mode === 'qa' ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                )}
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {mode === 'qa' ? "Enregistrer dans la file d'audit" : "Sauvegarder la Procédure dans le Registre"}
              </Button>
            </form>
          </Card>

          {/* Registre Provisoire (Uniquement pour FAQ) */}
          {mode === 'qa' && qaItems.length > 0 && (
            <div className="space-y-4 pb-12">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-secondary" /> 
                  Registre Provisoire ({qaItems.length})
                </h3>
                <Button onClick={handleFinalSubmit} disabled={isUploading} size="sm" className="bg-secondary text-secondary-foreground text-[9px] uppercase font-bold shadow-lg">
                  {isUploading ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <UploadCloud className="w-3 h-3 mr-2" />} Synchroniser Cloud
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {qaItems.map(item => (
                  <Card key={item.id} className={cn("p-4 border bg-card/20 relative group transition-all hover:bg-card/40", item.type === 'qa' ? "border-primary/20" : "border-secondary/20")}>
                    <Button variant="ghost" size="icon" onClick={() => setQaItems(prev => prev.filter(i => i.id !== item.id))} className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"><Trash2 className="w-3 h-3" /></Button>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]", item.type === 'qa' ? "text-primary bg-primary" : "text-secondary bg-secondary")} />
                      <p className={cn("text-[10px] font-bold uppercase pr-8 truncate", item.type === 'qa' ? "text-primary" : "text-secondary")}>{item.label}</p>
                    </div>
                    <p className="text-[9px] font-code text-muted-foreground line-clamp-3 italic bg-black/20 p-2 rounded-sm whitespace-pre-wrap">{item.details}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Dialog 
        open={mediaModal.isOpen} 
        onOpenChange={(open) => {
          if (!open) { setMediaModal(prev => ({ ...prev, isOpen: false })); setIsCapturing(false); }
        }}
      >
        <DialogContent className="sm:max-w-2xl bg-black border-primary/30 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xs uppercase font-headline tracking-widest text-primary flex items-center gap-2">
              {mediaModal.type === 'image' ? <Camera className="w-4 h-4" /> : <VideoIcon className="w-4 h-4" />}
              Capture de Preuve Industrielle
            </DialogTitle>
          </DialogHeader>
          <div className="relative aspect-video bg-muted/10 rounded-sm overflow-hidden border border-border">
            <video ref={videoRef} autoPlay playsInline muted={mediaModal.type === 'image'} className="w-full h-full object-cover" />
            <div className="absolute inset-0 pointer-events-none border-[15px] border-black/20" />
            {isCapturing && (
              <div className="absolute top-4 right-4 bg-red-600 text-white px-2 py-1 rounded-sm text-[10px] font-code animate-pulse flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" /> REC | {recordingTime}s
              </div>
            )}
          </div>
          <div className="flex justify-center gap-4 mt-4">
             {mediaModal.type === 'image' ? (
               <Button onClick={() => { 
                 if (videoRef.current && mediaModal.stepIndex !== null) {
                   const canvas = document.createElement('canvas');
                   canvas.width = videoRef.current.videoWidth || 640;
                   canvas.height = videoRef.current.videoHeight || 360;
                   const ctx = canvas.getContext('2d');
                   if (ctx) {
                     ctx.drawImage(videoRef.current, 0, 0);
                     const imageData = canvas.toDataURL('image/jpeg', 0.8);
                     setStepMediaData(prev => ({ ...prev, [mediaModal.stepIndex!]: { ...prev[mediaModal.stepIndex!], imageData } }));
                     toast({ title: `Image capturée` });
                   }
                 }
                 setMediaModal(prev => ({ ...prev, isOpen: false })); 
               }} className="bg-primary text-primary-foreground font-bold uppercase text-[10px] px-8"><Camera className="w-4 h-4 mr-2" /> Capturer</Button>
             ) : (
               !isCapturing ? (
                 <Button onClick={() => { 
                   setIsCapturing(true); 
                   setRecordingTime(0); 
                   chunksRef.current = [];
                   if (streamRef.current) {
                     const recorder = new MediaRecorder(streamRef.current);
                     recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
                     recorder.onstop = () => {
                       const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                       const reader = new FileReader();
                       reader.onloadend = () => {
                         if (mediaModal.stepIndex !== null && typeof reader.result === 'string') {
                           setStepMediaData(prev => ({ ...prev, [mediaModal.stepIndex!]: { ...prev[mediaModal.stepIndex!], videoData: reader.result as string } }));
                           toast({ title: `Vidéo enregistrée` });
                         }
                       };
                       reader.readAsDataURL(blob);
                     };
                     mediaRecorderRef.current = recorder;
                     recorder.start();
                   }
                   recordingIntervalRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000); 
                 }} className="bg-red-600 text-white font-bold uppercase text-[10px] px-8"><VideoIcon className="w-4 h-4 mr-2" /> Démarrer</Button>
               ) : (
                 <Button onClick={() => { 
                   setIsCapturing(false); 
                   if (recordingIntervalRef.current) {
                     clearInterval(recordingIntervalRef.current);
                     recordingIntervalRef.current = null;
                   }
                   if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                     mediaRecorderRef.current.stop();
                   }
                   setMediaModal(prev => ({ ...prev, isOpen: false })); 
                 }} className="bg-white text-black font-bold uppercase text-[10px] px-8"><StopCircle className="w-4 h-4 mr-2" /> Arrêter</Button>
               )
             )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
