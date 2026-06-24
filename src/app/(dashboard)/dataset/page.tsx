
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
  X
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
  images: string;
  video: string;
}

interface QAItem {
  id: string;
  type: 'qa' | 'procedure';
  label: string;
  details: string;
}

export default function DatasetPage() {
  const { toast } = useToast();
  
  // -- 1. TOUS LES HOOKS AU SOMMET (ORDRE FIXE) --
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'qa' | 'procedure'>('qa');
  const [qaItems, setQaItems] = useState<QAItem[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [procTitle, setProcTitle] = useState('');
  const [procSteps, setProcSteps] = useState<ProcedureStep[]>([
    { id: '1', title: '', duration: '', description: '', conditions: '', alarms: '', images: '', video: '' }
  ]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGuideActive, setIsGuideActive] = useState(false);
  
  // Media States
  const [mediaModal, setMediaModal] = useState<{ isOpen: boolean, type: 'image' | 'video', stepIndex: number | null }>({
    isOpen: false,
    type: 'image',
    stepIndex: null
  });
  const [isCapturing, setIsCapturing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  const [activeUIField, setActiveUIField] = useState<{ type: string, index?: number } | null>(null);
  const activeVoiceFieldRef = useRef<{ type: string, index?: number } | null>(null);

  // Synchronisation de la Ref pour le moteur vocal
  useEffect(() => {
    activeVoiceFieldRef.current = activeUIField;
  }, [activeUIField]);

  // Handler de résultat vocal ultra-stable
  const handleVoiceResult = useCallback((text: string) => {
    const target = activeVoiceFieldRef.current;
    if (!target) return;

    console.log(`[DATASET_AUDIT] Injection vocale -> ${target.type} [${target.index ?? 'root'}]`);

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
        else if (target.type === 'stepDescription') s.description = s.description ? `${s.description} ${text}` : text;
        else if (target.type === 'stepConditions') s.conditions = s.conditions ? `${s.conditions} ${text}` : text;
        else if (target.type === 'stepAlarms') s.alarms = s.alarms ? `${s.alarms} ${text}` : text;
        
        next[target.index!] = s;
        return next;
      });
    }
  }, []);

  const voice = useVoice({
    onResult: handleVoiceResult,
    autoRestart: true,
    lang: 'fr-FR'
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Gestion robuste du flux caméra
  useEffect(() => {
    const startStream = async () => {
      console.log(`[CAMERA_AUDIT] Début de startStream. mediaModal.isOpen=${mediaModal.isOpen}, type=${mediaModal.type}`);
      if (!mediaModal.isOpen) return;
      try {
        console.log(`[CAMERA_AUDIT] Demande d'accès getUserMedia (video: true, audio: ${mediaModal.type === 'video'})`);
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: mediaModal.type === 'video' 
        });
        console.log(`[CAMERA_AUDIT] Accès accordé. Pistes trouvées:`, stream.getTracks().map(t => `${t.kind} (${t.label})`));
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          console.log(`[CAMERA_AUDIT] Flux assigné à la balise vidéo.`);
        } else {
          console.warn(`[CAMERA_AUDIT] Attention: videoRef.current est null !`);
        }
      } catch (err: any) {
        console.warn(`[CAMERA_AUDIT] Erreur caméra interceptée:`, err.name, err.message, err);
        const errorDesc = err.name === 'NotFoundError' ? 'Aucune caméra trouvée sur cet appareil.' : 'Vérifiez les permissions de votre navigateur.';
        toast({ title: "Erreur Caméra", description: errorDesc, variant: "destructive" });
        setMediaModal(prev => ({ ...prev, isOpen: false }));
      }
    };

    const stopStream = () => {
      console.log(`[CAMERA_AUDIT] Exécution de stopStream. Flux actif: ${!!streamRef.current}`);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          console.log(`[CAMERA_AUDIT] Arrêt de la piste: ${track.kind}`);
          track.stop();
        });
        streamRef.current = null;
      }
    };

    if (mediaModal.isOpen) {
      console.log(`[CAMERA_AUDIT] mediaModal est ouvert, appel de startStream.`);
      startStream();
    } else {
      console.log(`[CAMERA_AUDIT] mediaModal est fermé, appel de stopStream.`);
      stopStream();
    }

    return () => {
      console.log(`[CAMERA_AUDIT] Nettoyage (cleanup) du useEffect de la caméra.`);
      stopStream();
    };
  }, [mediaModal.isOpen, mediaModal.type, toast]);

  // -- 2. LOGIQUE MÉTIER --

  const toggleVoice = (type: string, index?: number) => {
    const isCurrentlyActive = voice.isListening && activeUIField?.type === type && activeUIField?.index === index;
    if (isCurrentlyActive) {
      voice.stopListening();
      setActiveUIField(null);
    } else {
      voice.stopListening();
      setActiveUIField({ type, index });
      setTimeout(() => voice.startListening(), 50);
    }
  };

  const captureImage = () => {
    if (!videoRef.current || mediaModal.stepIndex === null) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUri = canvas.toDataURL('image/jpeg');
      const next = [...procSteps];
      next[mediaModal.stepIndex].images = `CAP_${Date.now()}_IMG`; // Simulé pour l'indexation RAG
      setProcSteps(next);
      toast({ title: "Image capturée", description: "Asset rattaché à l'étape." });
      setMediaModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current);
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      if (mediaModal.stepIndex === null) return;
      const next = [...procSteps];
      next[mediaModal.stepIndex].video = `CAP_${Date.now()}_VID`; // Référence simulée
      setProcSteps(next);
      toast({ title: "Vidéo enregistrée", description: "Séquence rattachée à l'étape." });
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsCapturing(true);
    setRecordingTime(0);
    const interval = setInterval(() => setRecordingTime(t => t + 1), 1000);
    (mediaRecorderRef.current as any)._interval = interval;
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isCapturing) {
      mediaRecorderRef.current.stop();
      if ((mediaRecorderRef.current as any)._interval) {
        clearInterval((mediaRecorderRef.current as any)._interval);
      }
      setIsCapturing(false);
      setMediaModal(prev => ({ ...prev, isOpen: false }));
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
      const details = procSteps.map((s, i) => 
        `[Étape ${i + 1}] ${s.title} (${s.duration})\nCONDITIONS: ${s.conditions}\nALARMES: ${s.alarms}\nASSETS: ${s.images} ${s.video}\nDÉTAILS: ${s.description}`
      ).join('\n\n');
      setQaItems(prev => [{ id: Date.now().toString(), type: 'procedure', label: procTitle, details }, ...prev]);
      setProcTitle('');
      setProcSteps([{ id: Date.now().toString(), title: '', duration: '', description: '', conditions: '', alarms: '', images: '', video: '' }]);
    }
    toast({ title: "Donnée enregistrée localement." });
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
      toast({ title: "Synchronisation Cloud Terminée" });
      setQaItems([]);
    } catch (e) {
      toast({ title: "Échec Synchronisation", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  // -- 3. RENDU (PROTECTION HYDRATATION DANS LE JSX) --

  if (!mounted) return null;

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
              <button onClick={() => setMode('qa')} className={cn("px-3 py-1 text-[9px] uppercase rounded-sm", mode === 'qa' ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground")}>FAQ</button>
              <button onClick={() => setMode('procedure')} className={cn("px-3 py-1 text-[9px] uppercase rounded-sm", mode === 'procedure' ? "bg-secondary text-secondary-foreground font-bold" : "text-muted-foreground")}>Procédure</button>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-5xl mx-auto w-full space-y-8">
          {voice.error && (voice.error.includes('allowed') || voice.error.includes('service')) && (
            <Card className="p-4 border-destructive/30 bg-destructive/5 animate-pulse">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <p className="text-[10px] font-code text-destructive uppercase font-bold">Microphone Bloqué ou Non Supporté. Vérifiez le SSL et les permissions.</p>
              </div>
            </Card>
          )}

          <Card className="p-6 border-border bg-card/50 space-y-6 rounded-sm shadow-2xl">
            <form onSubmit={handleAddItem} className="space-y-6">
              {mode === 'qa' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <p className="text-[10px] font-bold text-primary mb-2 uppercase tracking-widest">Symptôme / Question</p>
                    <Textarea 
                      value={question} 
                      onChange={(e) => setQuestion(e.target.value)} 
                      placeholder="EX: ÉCHAUFFEMENT POMPE P-101..." 
                      className={cn("h-32 bg-background font-code text-xs uppercase", activeUIField?.type === 'question' && "ring-2 ring-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]")}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('question')} className={cn("absolute top-8 right-2 h-7 w-7", activeUIField?.type === 'question' ? "text-red-500" : "text-primary")}>
                      <Mic className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="relative">
                    <p className="text-[10px] font-bold text-secondary mb-2 uppercase tracking-widest">Résolution / Réponse</p>
                    <Textarea 
                      value={answer} 
                      onChange={(e) => setAnswer(e.target.value)} 
                      placeholder="EX: VÉRIFIER LUBRIFICATION PALIER 2..." 
                      className={cn("h-32 bg-background font-code text-xs uppercase", activeUIField?.type === 'answer' && "ring-2 ring-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]")}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('answer')} className={cn("absolute top-8 right-2 h-7 w-7", activeUIField?.type === 'answer' ? "text-red-500" : "text-secondary")}>
                       <Mic className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="relative">
                    <p className="text-[10px] font-bold text-primary mb-2 uppercase tracking-widest">Titre de la procédure industrielle</p>
                    <Input 
                      value={procTitle} 
                      onChange={(e) => setProcTitle(e.target.value)} 
                      placeholder="MAINTENANCE CURATIVE UNITÉ A-4..." 
                      className={cn("bg-background uppercase h-12 text-sm font-bold", activeUIField?.type === 'procTitle' && "ring-2 ring-red-500")} 
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('procTitle')} className={cn("absolute top-8 right-2 h-7 w-7", activeUIField?.type === 'procTitle' ? "text-red-500" : "text-primary")}>
                      <Mic className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {procSteps.map((step, index) => (
                      <Card key={step.id} className="p-4 border-border bg-black/30 space-y-4">
                        <div className="flex justify-between items-center border-b border-border/50 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-secondary uppercase">Étape {index + 1}</span>
                            <Button type="button" variant="ghost" size="icon" onClick={() => setProcSteps(prev => prev.filter(s => s.id !== step.id))} className="h-6 w-6 text-muted-foreground hover:text-destructive" disabled={procSteps.length <= 1}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="relative">
                            <Input placeholder="DURÉE" value={step.duration} onChange={(e) => { const n = [...procSteps]; n[index].duration = e.target.value; setProcSteps(n); }} className={cn("h-7 w-32 text-[9px]", activeUIField?.type === 'stepDuration' && activeUIField?.index === index && "ring-1 ring-red-500")}/>
                            <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepDuration', index)} className="absolute right-0 top-0 h-7 w-7"><Mic className="w-2.5 h-2.5" /></Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="relative">
                            <p className="text-[8px] font-bold uppercase text-muted-foreground mb-1">Action</p>
                            <Input placeholder="Action..." value={step.title} onChange={(e) => { const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n); }} className={cn("h-8 text-[10px] uppercase", activeUIField?.type === 'stepTitle' && activeUIField?.index === index && "ring-1 ring-red-500")}/>
                            <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepTitle', index)} className="absolute top-5 right-1 h-7 w-7"><Mic className="w-3 h-3" /></Button>
                          </div>
                          <div className="relative">
                            <p className="text-[8px] font-bold uppercase text-muted-foreground mb-1">Détails</p>
                            <Input placeholder="Détails..." value={step.description} onChange={(e) => { const n = [...procSteps]; n[index].description = e.target.value; setProcSteps(n); }} className={cn("h-8 text-[10px] uppercase", activeUIField?.type === 'stepDescription' && activeUIField?.index === index && "ring-1 ring-red-500")}/>
                            <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepDescription', index)} className="absolute top-5 right-1 h-7 w-7"><Mic className="w-3 h-3" /></Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="relative">
                            <div className="flex items-center gap-1.5 mb-1"><ShieldAlert className="w-3 h-3 text-primary" /><p className="text-[8px] font-bold uppercase text-primary">Conditions</p></div>
                            <Input placeholder="Conditions..." value={step.conditions} onChange={(e) => { const n = [...procSteps]; n[index].conditions = e.target.value; setProcSteps(n); }} className={cn("h-8 text-[9px] uppercase", activeUIField?.type === 'stepConditions' && activeUIField?.index === index && "ring-1 ring-primary")}/>
                            <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepConditions', index)} className="absolute top-5 right-1 h-7 w-7"><Mic className="w-3 h-3" /></Button>
                          </div>
                          <div className="relative">
                            <div className="flex items-center gap-1.5 mb-1"><Bell className="w-3 h-3 text-destructive" /><p className="text-[8px] font-bold uppercase text-destructive">Alarmes</p></div>
                            <Input placeholder="Vigilance..." value={step.alarms} onChange={(e) => { const n = [...procSteps]; n[index].alarms = e.target.value; setProcSteps(n); }} className={cn("h-8 text-[9px] uppercase", activeUIField?.type === 'stepAlarms' && activeUIField?.index === index && "ring-1 ring-destructive")}/>
                            <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepAlarms', index)} className="absolute top-5 right-1 h-7 w-7"><Mic className="w-3 h-3" /></Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="relative">
                            <p className="text-[8px] font-bold uppercase text-secondary mb-1">Images (Capture/Ref)</p>
                            <div className="flex gap-1">
                              <Input placeholder="ID Image..." value={step.images} onChange={(e) => { const n = [...procSteps]; n[index].images = e.target.value; setProcSteps(n); }} className="h-8 text-[9px] uppercase bg-secondary/5"/>
                              <Button type="button" variant="secondary" size="icon" onClick={() => setMediaModal({ isOpen: true, type: 'image', stepIndex: index })} className="h-8 w-8 shrink-0"><Camera className="w-3.5 h-3.5" /></Button>
                            </div>
                          </div>
                          <div className="relative">
                            <p className="text-[8px] font-bold uppercase text-secondary mb-1">Vidéo (Capture/Path)</p>
                            <div className="flex gap-1">
                              <Input placeholder="ID Vidéo..." value={step.video} onChange={(e) => { const n = [...procSteps]; n[index].video = e.target.value; setProcSteps(n); }} className="h-8 text-[9px] uppercase bg-secondary/5"/>
                              <Button type="button" variant="secondary" size="icon" onClick={() => setMediaModal({ isOpen: true, type: 'video', stepIndex: index })} className="h-8 w-8 shrink-0"><VideoIcon className="w-3.5 h-3.5" /></Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <Button type="button" variant="outline" onClick={() => setProcSteps([...procSteps, { id: Date.now().toString(), title: '', duration: '', description: '', conditions: '', alarms: '', images: '', video: '' }])} className="w-full border-dashed h-10 text-[10px] uppercase hover:bg-secondary/5">
                    <Plus className="w-3 h-3 mr-2" /> Ajouter une étape
                  </Button>
                </div>
              )}

              <Button type="submit" className="w-full font-headline font-bold uppercase text-xs h-10 bg-primary text-primary-foreground">
                Enregistrer dans la file d'audit
              </Button>
            </form>
          </Card>

          {qaItems.length > 0 && (
            <div className="space-y-4 pb-12">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Layers className="w-3.5 h-3.5" /> Registre Provisoire ({qaItems.length})</h3>
                <Button onClick={handleFinalSubmit} disabled={isUploading} size="sm" className="bg-secondary text-secondary-foreground text-[9px] uppercase font-bold">
                  {isUploading ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <UploadCloud className="w-3 h-3 mr-2" />} Sync Cloud
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {qaItems.map(item => (
                  <Card key={item.id} className="p-4 border-border bg-card/20 relative group">
                    <Button variant="ghost" size="icon" onClick={() => setQaItems(prev => prev.filter(i => i.id !== item.id))} className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"><Trash2 className="w-3 h-3" /></Button>
                    <div className="flex items-center gap-2 mb-2"><span className={cn("w-1.5 h-1.5 rounded-full", item.type === 'qa' ? "bg-primary" : "bg-secondary")} /><p className="text-[10px] font-bold text-primary uppercase pr-8 truncate">{item.label}</p></div>
                    <p className="text-[9px] font-code text-muted-foreground line-clamp-4 italic bg-black/20 p-2 rounded-sm whitespace-pre-wrap">{item.details}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL MULTIMÉDIA STABILISÉ */}
      <Dialog 
        open={mediaModal.isOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setMediaModal(prev => ({ ...prev, isOpen: false }));
            setIsCapturing(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl bg-black border-primary/30 shadow-[0_0_50px_rgba(50,181,212,0.1)]">
          <DialogHeader>
            <DialogTitle className="text-xs uppercase font-headline tracking-widest text-primary flex items-center gap-2">
              {mediaModal.type === 'image' ? <Camera className="w-4 h-4" /> : <VideoIcon className="w-4 h-4" />}
              Station de capture industrielle
            </DialogTitle>
            <DialogDescription className="sr-only">
              Station de capture multimédia pour le dataset industriel
            </DialogDescription>
          </DialogHeader>
          <div className="relative aspect-video bg-muted/10 rounded-sm overflow-hidden border border-border">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted={mediaModal.type === 'image'} 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 pointer-events-none border-[20px] border-black/20" />
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle,transparent_40%,rgba(0,0,0,0.4)_100%)]" />
            
            {isCapturing && (
              <div className="absolute top-4 right-4 bg-red-600 text-white px-2 py-1 rounded-sm text-[10px] font-code animate-pulse flex items-center gap-2 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                REC | {recordingTime}s
              </div>
            )}
          </div>
          <div className="flex justify-center gap-4 mt-4">
            {mediaModal.type === 'image' ? (
              <Button onClick={captureImage} className="bg-primary text-primary-foreground font-bold uppercase text-[10px] h-10 px-8 hover:shadow-[0_0_15px_rgba(50,181,212,0.4)]">
                <Camera className="w-4 h-4 mr-2" /> Capturer l'image
              </Button>
            ) : (
              !isCapturing ? (
                <Button onClick={startRecording} className="bg-red-600 text-white font-bold uppercase text-[10px] h-10 px-8 hover:bg-red-700 hover:shadow-[0_0_15px_rgba(220,38,38,0.4)]">
                  <VideoIcon className="w-4 h-4 mr-2" /> Lancer l'enregistrement
                </Button>
              ) : (
                <Button onClick={stopRecording} className="bg-white text-black font-bold uppercase text-[10px] h-10 px-8 hover:bg-gray-200">
                  <StopCircle className="w-4 h-4 mr-2" /> Arrêter la capture
                </Button>
              )
            )}
            <Button variant="ghost" onClick={() => setMediaModal(prev => ({ ...prev, isOpen: false }))} className="text-[10px] uppercase">Fermer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
