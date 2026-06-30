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
  Undo2,
  Type
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
  
  const [phraseBuffers, setPhraseBuffers] = useState<Record<string, string[]>>({});
  
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  
  const [procTitle, setProcTitle] = useState('');
  const [procSteps, setProcSteps] = useState<ProcedureStep[]>([
    { id: '1', title: '', duration: '', description: '', conditions: '', alarms: '' }
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
      voice.speak("Assistant vocal désactivé.");
    } else {
      if (!voice.isSupported) {
        toast({ title: "Incompatible", description: "Reconnaissance vocale non supportée sur ce navigateur.", variant: "destructive" });
        return;
      }
      setIsAssistantActive(true);
      voice.startListening();
      voice.speak("Assistant vocal activé. Je vous guide.");
      
      if (!activeUIField) {
        if (mode === 'qa') handleFieldFocus('question');
        else handleFieldFocus('procTitle');
      }
    }
  };

  const handleFieldFocus = (type: string, index?: number) => {
    if (!isAssistantActive) return;
    setActiveUIField({ type, index });
    
    let instruction = "";
    if (type === 'question') instruction = "Dites le symptôme.";
    else if (type === 'answer') instruction = "Dites la résolution.";
    else if (type === 'procTitle') instruction = "Quel est le titre de la procédure ?";
    else if (type === 'stepTitle') instruction = `Action pour l'étape ${index! + 1}.`;
    else if (type === 'stepDescription') instruction = "Détails de l'opération ?";

    if (instruction) voice.speak(instruction);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'qa') {
      if (!question.trim() || !answer.trim()) {
        toast({ title: "Champs requis", variant: "destructive" });
        return;
      }
      setQaItems(prev => [{ id: Date.now().toString(), type: 'qa', label: question, details: answer }, ...prev]);
      setQuestion(''); setAnswer(''); setPhraseBuffers({});
      toast({ title: "Ajouté à la file" });
    } else {
      if (!procTitle.trim()) {
        toast({ title: "Titre requis", variant: "destructive" });
        return;
      }
      setIsUploading(true);
      try {
        const stepsWithMedia = procSteps.map((s, i) => ({
          ...s,
          imageData: stepMediaData[i]?.imageData ?? null,
          videoData: stepMediaData[i]?.videoData ?? null,
        }));

        const res = await fetch('/api/procedures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: procTitle, steps: stepsWithMedia }),
        });

        if (res.ok) {
          toast({ title: "Procédure sauvegardée dans le registre" });
          setProcTitle('');
          setProcSteps([{ id: Date.now().toString(), title: '', duration: '', description: '', conditions: '', alarms: '' }]);
          setStepMediaData({});
          setPhraseBuffers({});
        }
      } catch (err) {
        toast({ title: "Échec sauvegarde", variant: "destructive" });
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
        tags: [item.type, 'voice_input'],
        createdAt: new Date()
      }));
      await apiClient.post('/api/sync/upload', { userId: 'admin', projectId: 'project-001', items });
      toast({ title: "Synchronisé" });
      setQaItems([]);
    } catch (e) {
      toast({ title: "Échec Sync", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (!mediaModal.isOpen) return;
    const startStream = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: mediaModal.type === 'video' });
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (err) {
        toast({ title: "Erreur Caméra", variant: "destructive" });
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
                    <div className="absolute bottom-2 right-2">
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
                  {/* --- CHAMP TITRE DE LA PROCÉDURE --- */}
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <Type className="w-3.5 h-3.5 text-primary" />
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Titre de la procédure industrielle</p>
                    </div>
                    <Input 
                      value={procTitle} 
                      onChange={(e) => { setProcTitle(e.target.value); setPhraseBuffers(prev => ({...prev, procTitle: [e.target.value]})); }} 
                      onFocus={() => handleFieldFocus('procTitle')}
                      placeholder="MAINTENANCE CURATIVE UNITÉ A-4..." 
                      className={cn(
                        "bg-background uppercase h-12 text-sm font-bold transition-all border-primary/20", 
                        activeUIField?.type === 'procTitle' && "ring-2 ring-primary border-primary shadow-[0_0_15px_rgba(50,181,212,0.2)]"
                      )} 
                    />
                    <div className="absolute top-10 right-4">
                      <Mic className={cn("w-4 h-4", activeUIField?.type === 'procTitle' ? "text-primary animate-bounce" : "text-muted-foreground/20")} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    {procSteps.map((step, index) => (
                      <Card key={step.id} className="p-4 border-border bg-black/30 space-y-4 group">
                        <div className="flex justify-between items-center border-b border-border/50 pb-2">
                          <span className="text-[10px] font-bold text-secondary uppercase">Étape {index + 1}</span>
                          <Input 
                            placeholder="DURÉE" 
                            value={step.duration} 
                            onChange={(e) => { const n = [...procSteps]; n[index].duration = e.target.value; setProcSteps(n); }} 
                            className="h-7 w-24 text-[9px] uppercase"
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input 
                            placeholder="ACTION..." 
                            value={step.title} 
                            onFocus={() => handleFieldFocus('stepTitle', index)}
                            onChange={(e) => { const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n); }} 
                            className={cn("h-8 text-[10px] uppercase", activeUIField?.type === 'stepTitle' && activeUIField?.index === index && "ring-1 ring-secondary")}
                          />
                          <Input 
                            placeholder="DÉTAILS OPÉRATIONNELS..." 
                            value={step.description} 
                            onFocus={() => handleFieldFocus('stepDescription', index)}
                            onChange={(e) => { const n = [...procSteps]; n[index].description = e.target.value; setProcSteps(n); }} 
                            className={cn("h-8 text-[10px] uppercase", activeUIField?.type === 'stepDescription' && activeUIField?.index === index && "ring-1 ring-secondary")}
                          />
                        </div>

                        <div className="flex gap-2 pt-2">
                           <Button type="button" variant="secondary" size="sm" onClick={() => setMediaModal({ isOpen: true, type: 'image', stepIndex: index })} className={cn("h-7 text-[8px] uppercase font-bold flex-1", stepMediaData[index]?.imageData && "bg-secondary/80")}>
                             {stepMediaData[index]?.imageData ? <CheckCircle2 className="w-3 h-3 mr-2" /> : <Camera className="w-3 h-3 mr-2" />}
                             Capture Image
                           </Button>
                           <Button type="button" variant="outline" size="sm" onClick={() => setMediaModal({ isOpen: true, type: 'video', stepIndex: index })} className="h-7 text-[8px] uppercase font-bold flex-1">
                             {stepMediaData[index]?.videoData ? <CheckCircle2 className="w-3 h-3 mr-2" /> : <VideoIcon className="w-3 h-3 mr-2" />}
                             Séquence Vidéo
                           </Button>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <Button type="button" variant="ghost" onClick={() => setProcSteps([...procSteps, { id: Date.now().toString(), title: '', duration: '', description: '', conditions: '', alarms: '' }])} className="w-full border border-dashed border-border h-10 text-[9px] uppercase">
                    <Plus className="w-3.5 h-3.5 mr-2" /> Ajouter une étape
                  </Button>
                </div>
              )}

              <Button 
                type="submit" 
                disabled={isUploading}
                className={cn("w-full font-headline font-bold uppercase text-xs h-12 shadow-xl", mode === 'qa' ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {mode === 'qa' ? "Enregistrer dans la file" : "Sauvegarder la Procédure"}
              </Button>
            </form>
          </Card>
        </div>
      </main>

      <Dialog open={mediaModal.isOpen} onOpenChange={(o) => !o && setMediaModal(prev => ({ ...prev, isOpen: false }))}>
        <DialogContent className="sm:max-w-2xl bg-black border-primary/30 shadow-2xl">
          <DialogHeader><DialogTitle className="text-xs uppercase font-headline tracking-widest text-primary">Capture de Preuve</DialogTitle></DialogHeader>
          <div className="relative aspect-video bg-muted/10 rounded-sm overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted={mediaModal.type === 'image'} className="w-full h-full object-cover" />
            {isCapturing && <div className="absolute top-4 right-4 bg-red-600 text-white px-2 py-1 rounded-sm text-[10px] font-code animate-pulse">REC | {recordingTime}s</div>}
          </div>
          <div className="flex justify-center gap-4 mt-4">
             {mediaModal.type === 'image' ? (
               <Button onClick={() => { 
                 if (videoRef.current) {
                   const canvas = document.createElement('canvas');
                   canvas.width = 640; canvas.height = 360;
                   canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
                   setStepMediaData(prev => ({ ...prev, [mediaModal.stepIndex!]: { ...prev[mediaModal.stepIndex!], imageData: canvas.toDataURL('image/jpeg') } }));
                   setMediaModal(prev => ({ ...prev, isOpen: false }));
                 }
               }} className="bg-primary text-primary-foreground font-bold uppercase text-[10px] px-8">Capturer</Button>
             ) : (
               !isCapturing ? (
                 <Button onClick={() => { 
                   setIsCapturing(true); setRecordingTime(0); chunksRef.current = [];
                   const recorder = new MediaRecorder(streamRef.current!);
                   recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
                   recorder.onstop = () => {
                     const reader = new FileReader();
                     reader.onloadend = () => setStepMediaData(prev => ({ ...prev, [mediaModal.stepIndex!]: { ...prev[mediaModal.stepIndex!], videoData: reader.result as string } }));
                     reader.readAsDataURL(new Blob(chunksRef.current, { type: 'video/webm' }));
                   };
                   mediaRecorderRef.current = recorder; recorder.start();
                   recordingIntervalRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
                 }} className="bg-red-600 text-white font-bold uppercase text-[10px] px-8">Démarrer</Button>
               ) : (
                 <Button onClick={() => { 
                   setIsCapturing(false); clearInterval(recordingIntervalRef.current!);
                   mediaRecorderRef.current?.stop(); setMediaModal(prev => ({ ...prev, isOpen: false }));
                 }} className="bg-white text-black font-bold uppercase text-[10px] px-8">Arrêter</Button>
               )
             )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
