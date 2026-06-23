
"use client";

import { useState, useRef, useEffect } from 'react';
import { 
  Database, 
  Plus, 
  Trash2, 
  UploadCloud, 
  Cpu,
  Layers,
  Camera,
  Image as ImageIcon,
  Video,
  X,
  RefreshCw,
  Loader2,
  Circle,
  Eye,
  AlertTriangle,
  Upload,
  FileJson,
  Mic,
  MicOff,
  Activity,
  ShieldAlert,
  Bell,
  Clock
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle
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
  duration: string; // Nouveau champ : Durée estimée
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
  mediaAssets?: { type: 'image' | 'video', file: File, step: number }[];
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
  
  // Voice Integration State
  const [activeVoiceField, setActiveVoiceField] = useState<{ type: string, index?: number } | null>(null);

  const { isListening, isSupported, startListening, stopListening } = useVoice({
    onResult: (text) => {
      if (!activeVoiceField) return;
      
      const { type, index } = activeVoiceField;
      if (type === 'question') setQuestion(prev => (prev ? prev + ' ' + text : text));
      else if (type === 'answer') setAnswer(prev => (prev ? prev + ' ' + text : text));
      else if (type === 'procTitle') setProcTitle(prev => (prev ? prev + ' ' + text : text));
      else if (typeof index === 'number') {
        const newSteps = [...procSteps];
        if (type === 'stepTitle') newSteps[index].title = newSteps[index].title ? newSteps[index].title + ' ' + text : text;
        else if (type === 'stepDesc') newSteps[index].description = newSteps[index].description ? newSteps[index].description + ' ' + text : text;
        else if (type === 'stepNormal') newSteps[index].normalConditions = newSteps[index].normalConditions ? newSteps[index].normalConditions + ' ' + text : text;
        else if (type === 'stepAbnormal') newSteps[index].abnormalConditions = newSteps[index].abnormalConditions ? newSteps[index].abnormalConditions + ' ' + text : text;
        else if (type === 'stepAlarms') newSteps[index].alarms = newSteps[index].alarms ? newSteps[index].alarms + ' ' + text : text;
        else if (type === 'stepDuration') newSteps[index].duration = newSteps[index].duration ? newSteps[index].duration + ' ' + text : text;
        setProcSteps(newSteps);
      }
    },
    onEnd: () => setActiveVoiceField(null)
  });

  const toggleVoice = (type: string, index?: number) => {
    if (isListening) {
      stopListening();
      setActiveVoiceField(null);
    } else {
      setActiveVoiceField({ type, index });
      startListening();
    }
  };

  const [cameraOpen, setCameraModalOpen] = useState(false);
  const [cameraType, setCameraType] = useState<'image' | 'video'>('image');
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const desktopPhotoRef = useRef<HTMLInputElement>(null);
  const desktopVideoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      procSteps.forEach(s => {
        if (s.imagePreview) URL.revokeObjectURL(s.imagePreview);
        if (s.videoPreview) URL.revokeObjectURL(s.videoPreview);
      });
    };
  }, []);

  const revokeStepPreviews = (step: ProcedureStep) => {
    if (step.imagePreview) URL.revokeObjectURL(step.imagePreview);
    if (step.videoPreview) URL.revokeObjectURL(step.videoPreview);
  };

  const deleteStep = (id: string) => {
    const stepToDelete = procSteps.find(s => s.id === id);
    if (stepToDelete) revokeStepPreviews(stepToDelete);
    setProcSteps(prev => prev.filter(s => s.id !== id));
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, 
        audio: cameraType === 'video' 
      });
      setCameraStream(stream);
    } catch (err) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: cameraType === 'video' });
        setCameraStream(stream);
      } catch (err2) {
        setCameraError("Accès caméra refusé.");
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
  };

  useEffect(() => {
    if (cameraOpen) startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [cameraOpen, cameraType]);

  useEffect(() => {
    if (cameraOpen && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraOpen, cameraStream]);

  const processCapturedFile = async (file: File, index: number, type: 'image' | 'video') => {
    const newSteps = [...procSteps];
    if (type === 'image') {
      if (newSteps[index].imagePreview) URL.revokeObjectURL(newSteps[index].imagePreview!);
      newSteps[index].imageFile = file;
      newSteps[index].imagePreview = URL.createObjectURL(file);
    } else {
      if (newSteps[index].videoPreview) URL.revokeObjectURL(newSteps[index].videoPreview!);
      newSteps[index].videoFile = file;
      newSteps[index].videoPreview = URL.createObjectURL(file);
    }
    setProcSteps(newSteps);
  };

  const handleTriggerCapture = (e: React.MouseEvent, index: number, type: 'image' | 'video') => {
    e.preventDefault();
    setActiveStepIndex(index);
    if (isDesktop) {
      if (type === 'image') desktopPhotoRef.current?.click();
      else desktopVideoRef.current?.click();
    } else {
      setCameraType(type);
      setCameraModalOpen(true);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || activeStepIndex === null) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `snap_${Date.now()}.jpg`, { type: 'image/jpeg' });
        processCapturedFile(file, activeStepIndex, 'image');
        setCameraModalOpen(false);
      }
    }, 'image/jpeg', 0.9);
  };

  const toggleRecording = () => {
    if (!isRecording) {
      recordedChunksRef.current = [];
      if (!cameraStream) return;
      const mediaRecorder = new MediaRecorder(cameraStream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => recordedChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/mp4' });
        const file = new File([blob], `vid_${Date.now()}.mp4`, { type: 'video/mp4' });
        if (activeStepIndex !== null) processCapturedFile(file, activeStepIndex, 'video');
        setCameraModalOpen(false);
      };
      mediaRecorder.start();
      setIsRecording(true);
    } else {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'qa') {
      if (!question.trim() || !answer.trim()) return;
      setQaItems([{ id: Date.now().toString(), type: 'qa', label: question, details: answer }, ...qaItems]);
      setQuestion(''); setAnswer('');
    } else {
      if (!procTitle.trim()) return;
      const details = procSteps.map((s, i) => `[ÉTAPE ${i + 1}] ${s.title}\nDurée: ${s.duration || 'Indéfinie'}\nDesc: ${s.description}\nNormal: ${s.normalConditions}\nAbnormal: ${s.abnormalConditions}\nAlarms: ${s.alarms}`).join('\n');
      const assets = procSteps.flatMap((s, idx) => {
        const items = [];
        if (s.imageFile) items.push({ type: 'image' as const, file: s.imageFile, step: idx });
        if (s.videoFile) items.push({ type: 'video' as const, file: s.videoFile, step: idx });
        return items;
      });
      setQaItems([{ id: Date.now().toString(), type: 'procedure', label: procTitle, details, mediaAssets: assets }, ...qaItems]);
      setProcTitle('');
      procSteps.forEach(revokeStepPreviews);
      setProcSteps([{ id: Date.now().toString(), title: '', description: '', normalConditions: '', abnormalConditions: '', alarms: '', duration: '' }]);
    }
  };

  const handleFinalSubmitToWebBDD = async () => {
    if (qaItems.length === 0) return;
    setIsUploading(true);
    
    try {
      const uploadItems = [];
      for (const item of qaItems) {
        uploadItems.push({
          id: `doc-${item.id}`,
          projectId: 'project-001',
          type: 'document' as const,
          content: JSON.stringify({ label: item.label, details: item.details, type: item.type }),
          tags: [item.type, item.label.substring(0, 15)],
          createdAt: new Date()
        });

        if (item.mediaAssets) {
          for (const asset of item.mediaAssets) {
            const base64 = await new Promise<string>((res) => {
              const reader = new FileReader();
              reader.onload = () => res(reader.result as string);
              reader.readAsDataURL(asset.file);
            });
            uploadItems.push({
              id: `asset-${Date.now()}-${Math.random()}`,
              projectId: 'project-001',
              type: 'provisional_asset' as const,
              content: base64,
              metadata: { type: asset.type, title: item.label, step: asset.step },
              tags: ['media', item.type],
              createdAt: new Date()
            });
          }
        }
      }

      await apiClient.post('/api/sync/upload', { userId: 'admin', projectId: 'project-001', items: uploadItems });
      toast({ title: "Transfert Réussi", description: "Données JSON et médias envoyés vers la BDD Web." });
      setQaItems([]);
    } catch (e) {
      toast({ title: "Échec Transfert", description: "Liaison Web interrompue.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      
      <input type="file" accept="image/*" ref={desktopPhotoRef} className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file && activeStepIndex !== null) processCapturedFile(file, activeStepIndex, 'image');
      }} />
      <input type="file" accept="video/*" ref={desktopVideoRef} className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file && activeStepIndex !== null) processCapturedFile(file, activeStepIndex, 'video');
      }} />

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto terminal-scroll">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <Database className="w-4 h-4 text-primary animate-pulse" />
            <span className="font-headline font-bold text-xs lg:text-sm uppercase tracking-widest text-primary">Entraînement RAG</span>
          </div>
          <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
            <button onClick={() => setMode('qa')} className={cn("px-3 py-1.5 text-[9px] font-code uppercase rounded-sm transition-all", mode === 'qa' ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>Q / R</button>
            <button onClick={() => setMode('procedure')} className={cn("px-3 py-1.5 text-[9px] font-code uppercase rounded-sm transition-all", mode === 'procedure' ? "bg-secondary text-secondary-foreground" : "text-muted-foreground")}>Procédure</button>
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
          <Card className="p-4 lg:p-6 border-border bg-card/50 space-y-6 rounded-sm shadow-2xl">
            <form onSubmit={handleAddItem} className="space-y-6">
              {mode === 'qa' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative group">
                    <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="SYMPTÔME..." className="h-32 bg-background font-code text-xs uppercase pr-10" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('question')} className={cn("absolute top-2 right-2 h-7 w-7 transition-all", activeVoiceField?.type === 'question' ? "bg-red-500/20 text-red-500 animate-pulse" : "text-primary opacity-30 group-hover:opacity-100")} disabled={!isSupported}>
                      {activeVoiceField?.type === 'question' ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                  <div className="relative group">
                    <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="RÉSOLUTION..." className="h-32 bg-background font-code text-xs uppercase pr-10" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('answer')} className={cn("absolute top-2 right-2 h-7 w-7 transition-all", activeVoiceField?.type === 'answer' ? "bg-red-500/20 text-red-500 animate-pulse" : "text-primary opacity-30 group-hover:opacity-100")} disabled={!isSupported}>
                      {activeVoiceField?.type === 'answer' ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative group">
                    <Input value={procTitle} onChange={(e) => setProcTitle(e.target.value)} placeholder="TITRE PROCÉDURE" className="bg-background font-headline uppercase pr-10" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('procTitle')} className={cn("absolute top-1.5 right-2 h-7 w-7 transition-all", activeVoiceField?.type === 'procTitle' ? "bg-red-500/20 text-red-500 animate-pulse" : "text-primary opacity-30 group-hover:opacity-100")} disabled={!isSupported}>
                      {activeVoiceField?.type === 'procTitle' ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                  {procSteps.map((step, index) => (
                    <Card key={step.id} className="p-4 border-border bg-black/30 space-y-4">
                      <div className="flex justify-between items-center border-b border-border/50 pb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold font-code text-secondary">ÉTAPE {index + 1}</span>
                          <div className="flex items-center gap-2 relative group">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <Input 
                              placeholder="DURÉE (EX: 5 MIN)" 
                              value={step.duration} 
                              onChange={(e) => { const n = [...procSteps]; n[index].duration = e.target.value; setProcSteps(n); }} 
                              className="h-6 w-32 text-[9px] font-code bg-background/20 border-none uppercase"
                            />
                            <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepDuration', index)} className={cn("h-5 w-5 transition-all", (activeVoiceField?.type === 'stepDuration' && activeVoiceField.index === index) ? "bg-red-500/20 text-red-500 animate-pulse" : "text-primary opacity-0 group-hover:opacity-50")} disabled={!isSupported}>
                              {(activeVoiceField?.type === 'stepDuration' && activeVoiceField.index === index) ? <MicOff className="w-2.5 h-2.5" /> : <Mic className="w-2.5 h-2.5" />}
                            </Button>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deleteStep(step.id)} className="h-6 w-6 text-destructive"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="relative group">
                            <Input placeholder="TITRE ACTION" value={step.title} onChange={(e) => { const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n); }} className="h-9 text-[11px] font-code uppercase pr-10" />
                            <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepTitle', index)} className={cn("absolute top-1 right-2 h-7 w-7 transition-all", (activeVoiceField?.type === 'stepTitle' && activeVoiceField.index === index) ? "bg-red-500/20 text-red-500 animate-pulse" : "text-primary opacity-30 group-hover:opacity-100")} disabled={!isSupported}>
                              {(activeVoiceField?.type === 'stepTitle' && activeVoiceField.index === index) ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1 h-9 text-[9px] font-code" onClick={(e) => handleTriggerCapture(e, index, 'image')}><Camera className="w-3.5 h-3.5 mr-2" /> PHOTO</Button>
                            <Button variant="outline" size="sm" className="flex-1 h-9 text-[9px] font-code" onClick={(e) => handleTriggerCapture(e, index, 'video')}><Video className="w-3.5 h-3.5 mr-2" /> VIDEO</Button>
                          </div>
                        </div>
                        
                        <div className="relative group">
                          <Textarea placeholder="DESCRIPTION DÉTAILLÉE..." value={step.description} onChange={(e) => { const n = [...procSteps]; n[index].description = e.target.value; setProcSteps(n); }} className="h-20 bg-background/50 font-code text-[11px] uppercase pr-10" />
                          <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepDesc', index)} className={cn("absolute top-2 right-2 h-7 w-7 transition-all", (activeVoiceField?.type === 'stepDesc' && activeVoiceField.index === index) ? "bg-red-500/20 text-red-500 animate-pulse" : "text-primary opacity-30 group-hover:opacity-100")} disabled={!isSupported}>
                            {(activeVoiceField?.type === 'stepDesc' && activeVoiceField.index === index) ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1.5 relative group">
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-secondary uppercase mb-1">
                              <Activity className="w-3 h-3" /> Conditions Normales
                            </div>
                            <Input value={step.normalConditions} onChange={(e) => { const n = [...procSteps]; n[index].normalConditions = e.target.value; setProcSteps(n); }} className="h-8 text-[10px] font-code bg-background/20 pr-8" placeholder="NOMINAL..." />
                            <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepNormal', index)} className={cn("absolute bottom-1 right-1 h-6 w-6 transition-all", (activeVoiceField?.type === 'stepNormal' && activeVoiceField.index === index) ? "bg-red-500/20 text-red-500 animate-pulse" : "text-primary opacity-0 group-hover:opacity-40")} disabled={!isSupported}>
                              {(activeVoiceField?.type === 'stepNormal' && activeVoiceField.index === index) ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                            </Button>
                          </div>
                          
                          <div className="space-y-1.5 relative group">
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-primary uppercase mb-1">
                              <ShieldAlert className="w-3 h-3" /> Conditions Anormales
                            </div>
                            <Input value={step.abnormalConditions} onChange={(e) => { const n = [...procSteps]; n[index].abnormalConditions = e.target.value; setProcSteps(n); }} className="h-8 text-[10px] font-code bg-background/20 pr-8" placeholder="DÉRIVE..." />
                            <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepAbnormal', index)} className={cn("absolute bottom-1 right-1 h-6 w-6 transition-all", (activeVoiceField?.type === 'stepAbnormal' && activeVoiceField.index === index) ? "bg-red-500/20 text-red-500 animate-pulse" : "text-primary opacity-0 group-hover:opacity-40")} disabled={!isSupported}>
                              {(activeVoiceField?.type === 'stepAbnormal' && activeVoiceField.index === index) ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                            </Button>
                          </div>

                          <div className="space-y-1.5 relative group">
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-destructive uppercase mb-1">
                              <Bell className="w-3 h-3" /> Alarmes / Seuils
                            </div>
                            <Input value={step.alarms} onChange={(e) => { const n = [...procSteps]; n[index].alarms = e.target.value; setProcSteps(n); }} className="h-8 text-[10px] font-code bg-background/20 pr-8" placeholder="ALERTES..." />
                            <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepAlarms', index)} className={cn("absolute bottom-1 right-1 h-6 w-6 transition-all", (activeVoiceField?.type === 'stepAlarms' && activeVoiceField.index === index) ? "bg-red-500/20 text-red-500 animate-pulse" : "text-primary opacity-0 group-hover:opacity-40")} disabled={!isSupported}>
                              {(activeVoiceField?.type === 'stepAlarms' && activeVoiceField.index === index) ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                            </Button>
                          </div>
                        </div>

                        {(step.imagePreview || step.videoPreview) && (
                          <div className="flex gap-2 items-center">
                            <Badge variant="outline" className="text-[8px] uppercase bg-secondary/10 text-secondary border-secondary/20 px-2 py-0.5">Média attaché</Badge>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                  <Button type="button" variant="outline" onClick={() => setProcSteps([...procSteps, { id: Date.now().toString(), title: '', description: '', normalConditions: '', abnormalConditions: '', alarms: '', duration: '' }])} className="w-full border-dashed h-9 text-[10px] uppercase font-code border-primary/30 text-primary hover:bg-primary/5"><Plus className="w-3.5 h-3.5 mr-2" /> Ajouter Étape</Button>
                </div>
              )}
              <div className="flex justify-end pt-4 border-t border-border/50">
                <Button type="submit" size="sm" className="font-headline font-bold uppercase text-[10px] h-10 px-8 bg-primary shadow-lg shadow-primary/20">Ajouter à la file d'attente</Button>
              </div>
            </form>
          </Card>

          {qaItems.length > 0 && (
            <div className="space-y-4 pb-12">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> File d'attente ({qaItems.length})</h3>
                <Button onClick={handleFinalSubmitToWebBDD} disabled={isUploading} className="bg-primary text-[10px] uppercase font-bold h-9 px-6 shadow-xl">
                  {isUploading ? <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5 mr-2" />} 
                  Uplink vers BDD Web (JSON)
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {qaItems.map((item) => (
                  <Card key={item.id} className="p-3 border-border bg-black/20 font-code text-[9px] flex justify-between items-center rounded-sm group hover:border-primary/30 transition-colors">
                    <div className="truncate flex items-center gap-3">
                      <Badge variant="outline" className={cn("text-[8px] py-0 px-1.5", item.type === 'procedure' ? "text-secondary border-secondary/20" : "text-primary border-primary/20")}>{item.type === 'procedure' ? 'PROCÉDURE' : 'Q/R'}</Badge>
                      <span className="text-muted-foreground uppercase truncate max-w-[200px] sm:max-w-md">{item.label}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setQaItems(qaItems.filter(i => i.id !== item.id))} className="h-7 w-7 opacity-30 group-hover:opacity-100 hover:text-destructive transition-opacity"><Trash2 className="w-3 h-3" /></Button>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Dialog open={cameraOpen} onOpenChange={setCameraModalOpen}>
        <DialogContent className="max-w-xl bg-card border-primary/30 p-0 overflow-hidden">
          <div className="relative aspect-video bg-black flex items-center justify-center">
            {cameraStream ? <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" /> : <Loader2 className="w-8 h-8 animate-spin" />}
            {isRecording && <div className="absolute top-4 right-4 bg-red-600 px-2 py-1 rounded-full animate-pulse text-[10px] font-bold text-white uppercase">Rec...</div>}
          </div>
          <div className="p-4 flex items-center justify-center gap-6 bg-card/90">
            {cameraType === 'image' ? (
              <Button onClick={capturePhoto} className="h-14 w-14 rounded-full bg-primary shadow-2xl border-4 border-background hover:scale-110 transition-transform"><Camera className="w-6 h-6" /></Button>
            ) : (
              <Button onClick={toggleRecording} className={cn("h-14 w-14 rounded-full shadow-2xl border-4 border-background hover:scale-110 transition-transform", isRecording ? "bg-red-600 animate-pulse" : "bg-secondary")}><Video className="w-6 h-6" /></Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
