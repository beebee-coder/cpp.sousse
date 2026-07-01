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
  PlayCircle,
  AlertCircle
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
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'qa' | 'procedure'>('procedure');
  const [isUploading, setIsUploading] = useState(false);
  
  const [showCamera, setShowCamera] = useState<{ isOpen: boolean; stepIndex: number | null }>({ isOpen: false, stepIndex: null });
  const [cameraMode, setCameraType] = useState<'image' | 'video'>('image');
  const [isRecording, setIsRecording] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [phraseBuffers, setPhraseBuffers] = useState<Record<string, string[]>>({});
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

    if (lowerText === 'effacer') {
      setPhraseBuffers(prev => ({ ...prev, [key]: [] }));
      updateTextFromBuffer(key, []);
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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
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
        toast({ title: "Données incomplètes", variant: "destructive" });
        return;
      }
      setIsUploading(true);
      try {
        const res = await fetch('/api/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'qa', title: question.slice(0, 50), question, answer }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          toast({ title: "Savoir sémantique indexé ✅" });
          setQuestion(''); setAnswer(''); setPhraseBuffers({});
        } else {
          throw new Error(data.message || "Échec de liaison BDD");
        }
      } catch (err: any) {
        toast({ title: "Échec de l'indexation", description: err.message, variant: "destructive" });
      } finally { setIsUploading(false); }
    } else {
      if (!procTitle.trim() || procSteps.some(s => !s.title.trim())) {
        toast({ title: "Données manquantes", description: "Titre et Séquences requis.", variant: "destructive" });
        return;
      }
      setIsUploading(true);
      
      console.log("🚀 [FORGE_FRONT] ASSEMBLAGE_PAYLOAD_INDUSTRIEL...");

      try {
        const formattedSteps = procSteps.map((s, i) => ({
          id: `step-${Date.now()}-${i}`,
          order: i + 1,
          title: s.title.toUpperCase(),
          description: s.description || "Instruction technique standard.",
          duration: { value: parseInt(s.duration) || 60, unit: "seconds", display: `${s.duration}s`, type: "fixed" },
          action: { 
            type: "confirmation", 
            instruction: s.description || s.title, 
            ui: { component: "action_button", label: "Confirmer", icon: "check" } 
          },
          validation: {
            conditions: s.conditions ? [{ 
              id: `val-${i}`, 
              description: s.conditions, 
              type: "manual", 
              operator: "==", 
              value: "OK", 
              displayName: "Conformité" 
            }] : [],
            successExpression: "status == OK",
            timeout: { value: 300, unit: "seconds", action: "warn" }
          },
          media: s.media ? { [s.mediaType === 'image' ? 'image' : 'video']: { url: s.media } } : undefined
        }));

        const payload = { 
          title: procTitle, 
          steps: formattedSteps,
          metadata: { 
            category: "MAINTENANCE", 
            department: "PRODUCTION", 
            criticality: "MEDIUM", 
            version: "1.0.0"
          }
        };

        const res = await fetch('/api/procedures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        
        if (res.ok && data.success) {
          const successMsg = data.sqlStatus === 'BYPASSED' 
            ? "Forge réussie (Mode Registre Physique)" 
            : "Forge réussie (Mode Hybride)";
            
          toast({ 
            title: successMsg, 
            description: data.message || `L'actif "${procTitle}" est archivé.` 
          });
          
          if (data.sqlStatus === 'BYPASSED') {
            console.warn("⚠️ [FORGE_FRONT] Bypass SQL détecté :", data.diagnostic);
          }

          router.push('/procedures');
        } else {
          const errorMsg = data.message || "Échec de la forge industrielle.";
          console.error("❌ [FORGE_FRONT] REJET_BACKEND:", errorMsg);
          toast({ 
            title: "Échec de la Forge", 
            description: errorMsg, 
            variant: "destructive" 
          });
        }
      } catch (err: any) {
        console.error("❌ [FORGE_FRONT] ERREUR_CRITIQUE:", err.message);
        toast({ 
          title: "Échec critique", 
          description: "Le centre de forge est injoignable.", 
          variant: "destructive" 
        });
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
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Forge Industrielle</span>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => voice.isListening ? voice.stopListening() : voice.startListening()} 
              className={cn("h-9 text-[9px] font-code uppercase", voice.isListening && "bg-red-500/10 text-red-500 border-red-500/40")}
            >
              {voice.isListening ? <Sparkles className="w-3.5 h-3.5 mr-2 animate-pulse" /> : <Mic className="w-3.5 h-3.5 mr-2" />}
              {voice.isListening ? "DICTÉE ACTIVE" : "MICRO OFF"}
            </Button>
            <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
              <button onClick={() => setMode('qa')} className={cn("px-4 py-1 text-[9px] uppercase rounded-sm font-bold transition-all", mode === 'qa' ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>Savoir</button>
              <button onClick={() => setMode('procedure')} className={cn("px-4 py-1 text-[9px] uppercase rounded-sm font-bold transition-all", mode === 'procedure' ? "bg-secondary text-secondary-foreground" : "text-muted-foreground")}>Procédure</button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto terminal-scroll p-4 lg:p-8">
          <form onSubmit={handleAddItem} className="max-w-5xl mx-auto space-y-8 pb-20">
            <Card className="p-4 bg-primary/5 border border-primary/20 flex items-center gap-4">
               <Zap className="w-8 h-8 text-primary" />
               <div className="space-y-1">
                 <p className="text-[10px] font-code text-white uppercase font-bold">Flux d'archivage résilient</p>
                 <p className="text-[9px] font-code text-muted-foreground uppercase leading-tight">
                   Liaison prioritaire vers Registre Physique .registry/ (Bypass SQL activé)
                 </p>
               </div>
            </Card>

            <div className="space-y-10">
              {mode === 'qa' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
                  <div className="space-y-4">
                    <Badge variant="outline" className="text-[8px] font-bold text-primary tracking-widest uppercase">Anomalie détectée</Badge>
                    <Textarea 
                      value={question} 
                      onChange={(e) => setQuestion(e.target.value)} 
                      onFocus={() => setActiveUIField({ type: 'question' })} 
                      placeholder="DÉCRIRE L'ANOMALIE..." 
                      className="h-64 bg-black/40 font-code text-xs uppercase border-primary/20" 
                    />
                  </div>
                  <div className="space-y-4">
                    <Badge variant="outline" className="text-[8px] font-bold text-secondary tracking-widest uppercase">Action de résolution</Badge>
                    <Textarea 
                      value={answer} 
                      onChange={(e) => setAnswer(e.target.value)} 
                      onFocus={() => setActiveUIField({ type: 'answer' })} 
                      placeholder="DÉCRIRE LA RÉSOLUTION..." 
                      className="h-64 bg-black/40 font-code text-xs uppercase border-secondary/20" 
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-4 animate-in fade-in duration-500">
                    <label className="text-[10px] font-bold text-primary uppercase tracking-widest block">Intitulé de la procédure</label>
                    <Input 
                      value={procTitle} 
                      onChange={(e) => setProcTitle(e.target.value)} 
                      onFocus={() => setActiveUIField({ type: 'procTitle' })} 
                      placeholder="EX: DÉMARRAGE POMPE CRF..." 
                      className="bg-black/60 uppercase h-14 text-sm font-bold border-primary/30" 
                    />
                  </div>

                  <div className="space-y-6">
                    {procSteps.map((step, index) => (
                      <Card key={index} className="p-6 border-border bg-black/30 space-y-6 relative group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-secondary/30 group-hover:bg-secondary transition-colors" />
                        
                        <div className="flex justify-between items-center border-b border-border/50 pb-3">
                          <div className="flex items-center gap-3">
                             <div className="w-7 h-7 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center text-[11px] font-bold text-secondary font-code">{index + 1}</div>
                             <span className="text-[10px] font-bold text-white uppercase tracking-wider">Séquence Opérationnelle</span>
                          </div>
                          <div className="flex items-center gap-4">
                             <div className="flex items-center gap-2 bg-muted/20 px-3 py-1 rounded-sm border border-border">
                                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                <Input 
                                  value={step.duration} 
                                  onChange={(e) => { const n = [...procSteps]; n[index].duration = e.target.value; setProcSteps(n); }} 
                                  className="h-6 w-12 text-[10px] font-code text-center bg-transparent border-none p-0 focus-visible:ring-0" 
                                />
                                <span className="text-[9px] font-code text-muted-foreground uppercase">sec</span>
                             </div>
                             <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => { const next = [...procSteps]; next.splice(index, 1); setProcSteps(next); }} 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                             >
                                <Trash2 className="w-3.5 h-3.5" />
                             </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Action</p>
                              <Input 
                                value={step.title} 
                                onFocus={() => setActiveUIField({ type: 'stepTitle', index })} 
                                onChange={(e) => { const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n); }} 
                                className="h-10 text-[10px] uppercase font-bold bg-black/20" 
                              />
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Instructions</p>
                              <Textarea 
                                value={step.description} 
                                onFocus={() => setActiveUIField({ type: 'stepDescription', index })} 
                                onChange={(e) => { const n = [...procSteps]; n[index].description = e.target.value; setProcSteps(n); }} 
                                className="h-32 text-[10px] uppercase font-code bg-black/20 resize-none" 
                              />
                            </div>
                          </div>

                          <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <p className="text-[9px] font-bold text-primary uppercase tracking-widest">Vérification</p>
                                <Input 
                                  value={step.conditions} 
                                  onChange={(e) => { const n = [...procSteps]; n[index].conditions = e.target.value; setProcSteps(n); }} 
                                  placeholder="EX: PRESSION > 5 BARS" 
                                  className="h-10 text-[10px] uppercase font-code bg-primary/5 border-primary/20" 
                                />
                              </div>
                              <div className="space-y-1.5">
                                <p className="text-[9px] font-bold text-destructive uppercase tracking-widest">Condition d'Alerte</p>
                                <Input 
                                  value={step.alarms} 
                                  onChange={(e) => { const n = [...procSteps]; n[index].alarms = e.target.value; setProcSteps(n); }} 
                                  placeholder="EX: FUITE DÉTECTÉE" 
                                  className="h-10 text-[10px] uppercase font-code bg-destructive/5 border-destructive/20" 
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Ressource Visuelle</p>
                              <div className="flex gap-2">
                                {!step.media ? (
                                  <>
                                    <Button 
                                      type="button" 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => startCamera('image', index)} 
                                      className="flex-1 h-12 text-[9px] border-dashed"
                                    >
                                      <Camera className="w-4 h-4 mr-2 text-primary" /> PHOTO
                                    </Button>
                                    <Button 
                                      type="button" 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => startCamera('video', index)} 
                                      className="flex-1 h-12 text-[9px] border-dashed"
                                    >
                                      <VideoIcon className="w-4 h-4 mr-2 text-secondary" /> VIDÉO
                                    </Button>
                                  </>
                                ) : (
                                  <div className="relative w-full aspect-video rounded-sm border border-border overflow-hidden bg-black shadow-2xl">
                                    {step.mediaType === 'image' ? (
                                      <img src={step.media} className="w-full h-full object-cover" />
                                    ) : (
                                      <video src={step.media} controls className="w-full h-full" />
                                    )}
                                    <Button 
                                      type="button" 
                                      variant="destructive" 
                                      size="icon" 
                                      onClick={() => { const next = [...procSteps]; delete next[index].media; setProcSteps(next); }} 
                                      className="absolute top-2 right-2 h-7 w-7"
                                    >
                                      <X className="w-4 h-4" />
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

                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setProcSteps([...procSteps, { id: Date.now().toString(), title: '', duration: '60', description: '', conditions: '', alarms: '' }])} 
                    className="w-full border-dashed h-14 text-[10px] uppercase font-bold"
                  >
                    <Plus className="w-3.5 h-3.5 mr-2 text-secondary" /> Ajouter une séquence
                  </Button>
                </>
              )}

              <div className="pt-10 border-t border-border/50">
                <Button 
                  type="submit" 
                  disabled={isUploading} 
                  className={cn(
                    "w-full font-headline font-bold uppercase text-xs h-16 shadow-2xl transition-all active:scale-[0.99]", 
                    mode === 'qa' ? "bg-primary hover:bg-primary/90" : "bg-secondary hover:bg-secondary/90"
                  )}
                >
                  {isUploading ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <CheckCircle2 className="w-6 h-6 mr-3" />}
                  {mode === 'qa' ? "Indexer dans la base RAG" : "Forger l'actif et Archiver"}
                </Button>
              </div>
            </div>
          </form>
        </div>

        {showCamera.isOpen && (
          <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4">
             <Card className="w-full max-w-4xl overflow-hidden border-primary/20 bg-black shadow-2xl">
                <div className="p-4 border-b border-border flex justify-between items-center">
                   <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                      <span className="text-[10px] font-bold text-white uppercase tracking-widest font-code">Capture Frame {showCamera.stepIndex! + 1}</span>
                   </div>
                   <Button variant="ghost" size="icon" onClick={stopCamera}><X className="w-6 h-6" /></Button>
                </div>
                <div className="relative aspect-video bg-muted/5">
                   <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-90" />
                   {isRecording && (
                     <div className="absolute top-6 right-6 flex items-center gap-3 bg-red-600 px-4 py-1.5 rounded-sm animate-pulse">
                        <div className="w-2.5 h-2.5 bg-white rounded-full" />
                        <span className="text-[11px] font-bold text-white uppercase font-code">ENREGISTREMENT</span>
                     </div>
                   )}
                </div>
                <div className="p-8 flex justify-center gap-8">
                   {cameraMode === 'image' ? (
                     <Button onClick={capturePhoto} className="px-16 h-16 bg-primary text-primary-foreground font-bold uppercase text-sm shadow-2xl hover:scale-105 transition-transform"><Camera className="w-7 h-7 mr-3" /> CAPTURER</Button>
                   ) : (
                     !isRecording ? (
                        <Button onClick={startRecording} className="px-16 h-16 bg-red-600 text-white font-bold uppercase text-sm shadow-2xl hover:bg-red-700 transition-all"><PlayCircle className="w-7 h-7 mr-3" /> LANCER</Button>
                     ) : (
                        <Button onClick={stopRecording} className="px-16 h-16 bg-white text-black font-bold uppercase text-sm shadow-2xl animate-pulse hover:bg-muted transition-all">STOPPER</Button>
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
