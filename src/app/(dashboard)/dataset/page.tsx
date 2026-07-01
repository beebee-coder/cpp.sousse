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
  Info,
  ShieldAlert,
  Image as ImageIcon,
  Video as VideoIcon,
  Camera,
  CheckCircle2,
  Volume2,
  Type,
  Clock,
  Zap,
  X,
  PlayCircle
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { useVoice } from '@/hooks/use-voice';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface DictationStep {
  id: string;
  title: string;
  duration: string;
  description: string;
  conditions: string;
  alarms: string;
  media?: string;
  mediaType?: 'image' | 'video';
}

export default function DatasetPage() {
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'qa' | 'procedure'>('procedure');
  const [isUploading, setIsUploading] = useState(false);
  const [isAssistantActive, setIsAssistantActive] = useState(false);
  
  // États média
  const [showCamera, setShowCamera] = useState<{ isOpen: boolean; stepIndex: number | null }>({ isOpen: false, stepIndex: null });
  const [cameraMode, setCameraType] = useState<'image' | 'video'>('image');
  const [isRecording, setIsRecording] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Tampon pour la dictée
  const [phraseBuffers, setPhraseBuffers] = useState<Record<string, string[]>>({});
  
  // Champs
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [procTitle, setProcTitle] = useState('');
  const [procSteps, setProcSteps] = useState<DictationStep[]>([
    { id: '1', title: '', duration: '60', description: '', conditions: '', alarms: '' }
  ]);

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
        else if (type === 'stepDescription') s.description = fullText;
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

    if (lowerText === 'non' || lowerText === 'effacer') {
      setPhraseBuffers(prev => {
        const current = prev[key] || [];
        if (current.length === 0) return prev;
        const next = current.slice(0, -1);
        updateTextFromBuffer(key, next);
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

  const voice = useVoice({ onResult: handleVoiceResult, autoRestart: true, lang: 'fr-FR' });

  useEffect(() => { setMounted(true); }, []);

  // Logique Caméra
  const startCamera = async (type: 'image' | 'video', stepIndex: number) => {
    setCameraType(type);
    setShowCamera({ isOpen: true, stepIndex });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 }, 
        audio: type === 'video' 
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      toast({ title: "Accès Caméra Refusé", variant: "destructive" });
      setShowCamera({ isOpen: false, stepIndex: null });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setShowCamera({ isOpen: false, stepIndex: null });
    setIsRecording(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || showCamera.stepIndex === null) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    const data = canvas.toDataURL('image/jpeg', 0.85);
    const next = [...procSteps];
    next[showCamera.stepIndex].media = data;
    next[showCamera.stepIndex].mediaType = 'image';
    setProcSteps(next);
    stopCamera();
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current);
    recorder.ondataavailable = e => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/mp4' });
      const reader = new FileReader();
      reader.onloadend = () => {
        if (showCamera.stepIndex !== null) {
          const next = [...procSteps];
          next[showCamera.stepIndex].media = reader.result as string;
          next[showCamera.stepIndex].mediaType = 'video';
          setProcSteps(next);
        }
      };
      reader.readAsDataURL(blob);
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      stopCamera();
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;

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
        toast({ title: "Échec", variant: "destructive" });
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
          title: s.title || `Séquence ${i + 1}`,
          description: s.description || "Instruction technique",
          duration: { value: parseInt(s.duration) || 60, unit: "seconds", display: `${s.duration}s`, type: "fixed" },
          action: { type: "confirmation", instruction: s.description, ui: { component: "action_button", label: "Confirmer", icon: "check" } },
          validation: {
            conditions: s.conditions ? [{ id: `val-${i}`, description: s.conditions, type: "status", operator: "==", value: "OK", displayName: "Validation" }] : [],
            successExpression: "status == OK",
            timeout: { value: 300, unit: "seconds", action: "warn" }
          },
          media: s.media ? { [s.mediaType === 'image' ? 'image' : 'video']: { url: s.media } } : undefined
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
          toast({ title: "Procédure forgée" });
          setProcTitle('');
          setProcSteps([{ id: '1', title: '', duration: '60', description: '', conditions: '', alarms: '' }]);
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
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <Database className="w-4 h-4 text-primary" />
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Station de Dictée Industrielle</span>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => isAssistantActive ? voice.stopListening() : voice.startListening()} 
              className={cn("h-9 text-[9px] font-code uppercase", isAssistantActive && "bg-primary/20 text-primary")}
            >
              {isAssistantActive ? <Sparkles className="w-3.5 h-3.5 mr-2" /> : <Mic className="w-3.5 h-3.5 mr-2" />}
              Assistant {isAssistantActive ? "ACTIF" : "VEILLE"}
            </Button>
            <div className="flex bg-muted/30 p-1 rounded-sm border border-border shadow-inner">
              <button onClick={() => setMode('qa')} className={cn("px-4 py-1 text-[9px] uppercase rounded-sm font-bold", mode === 'qa' ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>FAQ</button>
              <button onClick={() => setMode('procedure')} className={cn("px-4 py-1 text-[9px] uppercase rounded-sm font-bold", mode === 'procedure' ? "bg-secondary text-secondary-foreground" : "text-muted-foreground")}>Procédure</button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto terminal-scroll p-4 lg:p-8">
          <form onSubmit={handleAddItem} className="max-w-5xl mx-auto space-y-8 pb-12">
            <Card className="p-4 bg-primary/5 border border-primary/20 flex items-center gap-4">
               <Zap className="w-8 h-8 text-primary" />
               <p className="text-[9px] font-code text-muted-foreground uppercase leading-tight">
                 Toute entrée validée est automatiquement vectorisée pour l'IA et archivée dans le registre physique <span className="text-white font-bold">.registry/procedures/</span>.
               </p>
            </Card>

            <div className="space-y-10">
              {mode === 'qa' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <Badge variant="outline" className="text-[8px] font-bold text-primary">SYMPTÔME</Badge>
                    <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} onFocus={() => setActiveUIField({ type: 'question' })} placeholder="DÉTAILLEZ L'ANOMALIE..." className="h-48 bg-black/40 font-code text-xs uppercase" />
                  </div>
                  <div className="space-y-4">
                    <Badge variant="outline" className="text-[8px] font-bold text-secondary">RÉSOLUTION</Badge>
                    <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} onFocus={() => setActiveUIField({ type: 'answer' })} placeholder="DÉTAILLEZ LA RÉSOLUTION..." className="h-48 bg-black/40 font-code text-xs uppercase" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-primary uppercase tracking-widest block">Titre de la procédure</label>
                    <Input value={procTitle} onChange={(e) => setProcTitle(e.target.value)} onFocus={() => setActiveUIField({ type: 'procTitle' })} placeholder="EX: DÉMARRAGE POMPE CENTRIFUGE CRF-101..." className="bg-black/60 uppercase h-14 text-sm font-bold border-primary/30" />
                  </div>

                  <div className="space-y-6">
                    {procSteps.map((step, index) => (
                      <Card key={index} className="p-6 border-border bg-black/30 space-y-6 group transition-all hover:border-primary/20">
                        <div className="flex justify-between items-center border-b border-border/50 pb-3">
                          <div className="flex items-center gap-3">
                             <div className="w-6 h-6 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center text-[10px] font-bold text-secondary">{index + 1}</div>
                             <span className="text-[10px] font-bold text-white uppercase tracking-wider">Séquence Technique</span>
                          </div>
                          <div className="flex items-center gap-4">
                             <div className="flex items-center gap-2 bg-muted/20 px-2 py-1 rounded-sm border border-border">
                                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                <Input value={step.duration} onChange={(e) => { const n = [...procSteps]; n[index].duration = e.target.value; setProcSteps(n); }} className="h-6 w-14 text-[10px] font-code text-center bg-transparent border-none p-0 focus-visible:ring-0" />
                                <span className="text-[9px] font-code text-muted-foreground uppercase">sec</span>
                             </div>
                             <Button variant="ghost" size="icon" onClick={() => { const next = [...procSteps]; next.splice(index, 1); setProcSteps(next); }} className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 className="w-3.5 h-3.5" />
                             </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <p className="text-[9px] font-bold text-muted-foreground uppercase">Intitulé de l'action</p>
                              <Input value={step.title} onFocus={() => setActiveUIField({ type: 'stepTitle', index })} onChange={(e) => { const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n); }} className="h-10 text-[10px] uppercase font-bold bg-black/20" />
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-[9px] font-bold text-muted-foreground uppercase">Consigne technique</p>
                              <Textarea value={step.description} onFocus={() => setActiveUIField({ type: 'stepDescription', index })} onChange={(e) => { const n = [...procSteps]; n[index].description = e.target.value; setProcSteps(n); }} className="h-24 text-[10px] uppercase font-code bg-black/20 resize-none" />
                            </div>
                          </div>

                          <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <p className="text-[9px] font-bold text-primary uppercase">Validation</p>
                                <Input value={step.conditions} onChange={(e) => { const n = [...procSteps]; n[index].conditions = e.target.value; setProcSteps(n); }} placeholder="EX: PRESSION > 5..." className="h-10 text-[10px] uppercase font-code bg-primary/5 border-primary/20" />
                              </div>
                              <div className="space-y-1.5">
                                <p className="text-[9px] font-bold text-destructive uppercase">Alertes</p>
                                <Input value={step.alarms} onChange={(e) => { const n = [...procSteps]; n[index].alarms = e.target.value; setProcSteps(n); }} placeholder="EX: FUIE..." className="h-10 text-[10px] uppercase font-code bg-destructive/5 border-destructive/20" />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <p className="text-[9px] font-bold text-muted-foreground uppercase">Documentation Visuelle</p>
                              <div className="flex gap-2">
                                {!step.media ? (
                                  <>
                                    <Button type="button" variant="outline" size="sm" onClick={() => startCamera('image', index)} className="flex-1 h-12 text-[9px] border-dashed border-border hover:bg-primary/5 hover:border-primary/40">
                                      <Camera className="w-4 h-4 mr-2 text-primary" /> PHOTO
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" onClick={() => startCamera('video', index)} className="flex-1 h-12 text-[9px] border-dashed border-border hover:bg-secondary/5 hover:border-secondary/40">
                                      <VideoIcon className="w-4 h-4 mr-2 text-secondary" /> VIDÉO
                                    </Button>
                                  </>
                                ) : (
                                  <div className="relative w-full aspect-video rounded-sm border border-border overflow-hidden bg-black">
                                    {step.mediaType === 'image' ? (
                                      <img src={step.media} className="w-full h-full object-cover" />
                                    ) : (
                                      <video src={step.media} controls className="w-full h-full" />
                                    )}
                                    <Button type="button" variant="destructive" size="icon" onClick={() => { const next = [...procSteps]; delete next[index].media; setProcSteps(next); }} className="absolute top-2 right-2 h-6 w-6">
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <Button type="button" variant="outline" onClick={() => setProcSteps([...procSteps, { id: Date.now().toString(), title: '', duration: '60', description: '', conditions: '', alarms: '' }])} className="w-full border-dashed border-border h-12 text-[10px] uppercase font-bold hover:bg-secondary/5 transition-all">
                    <Plus className="w-4 h-4 mr-2 text-secondary" /> Ajouter une séquence opérationnelle
                  </Button>
                </>
              )}

              <div className="pt-10 border-t border-border/50">
                <Button type="submit" disabled={isUploading} className={cn("w-full font-headline font-bold uppercase text-xs h-16 shadow-2xl transition-all", mode === 'qa' ? "bg-primary" : "bg-secondary")}>
                  {isUploading ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <CheckCircle2 className="w-6 h-6 mr-3" />}
                  {mode === 'qa' ? "Enregistrer dans la file sémantique" : "Forger la Procédure et Indexer"}
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* Caméra Overlay */}
        {showCamera.isOpen && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
             <Card className="w-full max-w-3xl overflow-hidden border-primary/20 bg-black shadow-[0_0_50px_rgba(0,0,0,1)]">
                <div className="p-4 border-b border-border flex justify-between items-center bg-card/30">
                   <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                      <span className="text-[10px] font-bold text-white uppercase tracking-widest">Moteur de vision direct</span>
                   </div>
                   <Button variant="ghost" size="icon" onClick={stopCamera} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></Button>
                </div>
                <div className="relative aspect-video bg-muted/10">
                   <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                   {isRecording && (
                     <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600 px-3 py-1 rounded-sm animate-pulse">
                        <div className="w-2 h-2 bg-white rounded-full" />
                        <span className="text-[10px] font-bold text-white uppercase font-code">REC</span>
                     </div>
                   )}
                </div>
                <div className="p-6 flex justify-center gap-6 bg-card/30">
                   {cameraMode === 'image' ? (
                     <Button onClick={capturePhoto} className="px-12 h-14 bg-primary text-primary-foreground font-bold uppercase shadow-xl"><Camera className="w-6 h-6 mr-3" /> CAPTURER FRAME</Button>
                   ) : (
                     !isRecording ? (
                        <Button onClick={startRecording} className="px-12 h-14 bg-red-600 text-white font-bold uppercase shadow-xl"><VideoIcon className="w-6 h-6 mr-3" /> LANCER ENREGISTREMENT</Button>
                     ) : (
                        <Button onClick={stopRecording} className="px-12 h-14 bg-white text-black font-bold uppercase shadow-xl animate-pulse">STOPPER FLUX</Button>
                     )
                   )}
                </div>
             </Card>
          </div>
        )}
      </main>
    </div>
  );
}
