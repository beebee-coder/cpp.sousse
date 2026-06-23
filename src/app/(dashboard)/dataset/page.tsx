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
  FileJson
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
import { cn } from '@/lib/utils';

interface ProcedureStep {
  id: string;
  title: string;
  description: string;
  normalConditions: string;
  abnormalConditions: string;
  alarms: string;
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
    { id: '1', title: '', description: '', normalConditions: '', abnormalConditions: '', alarms: '' }
  ]);

  const [isUploading, setIsUploading] = useState(false);
  
  const [cameraOpen, setCameraModalOpen] = useState(false);
  const [cameraType, setCameraType] = useState<'image' | 'video'>('image');
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const desktopPhotoRef = useRef<HTMLInputElement>(null);
  const desktopVideoRef = useRef<HTMLInputElement>(null);
  const fallbackFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      procSteps.forEach(s => {
        if (s.imagePreview) URL.revokeObjectURL(s.imagePreview);
        if (s.videoPreview) URL.revokeObjectURL(s.videoPreview);
      });
    };
  }, []);

  useEffect(() => {
    if (cameraOpen && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraOpen, cameraStream]);

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
      const mediaRecorder = new MediaRecorder(cameraStream!);
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
      const details = procSteps.map((s, i) => `[ÉTAPE ${i + 1}] ${s.title}: ${s.description}`).join('\n');
      const assets = procSteps.flatMap((s, idx) => {
        const items = [];
        if (s.imageFile) items.push({ type: 'image' as const, file: s.imageFile, step: idx });
        if (s.videoFile) items.push({ type: 'video' as const, file: s.videoFile, step: idx });
        return items;
      });
      setQaItems([{ id: Date.now().toString(), type: 'procedure', label: procTitle, details, mediaAssets: assets }, ...qaItems]);
      setProcTitle('');
      setProcSteps([{ id: '1', title: '', description: '', normalConditions: '', abnormalConditions: '', alarms: '' }]);
    }
  };

  const handleFinalSubmitToWebBDD = async () => {
    if (qaItems.length === 0) return;
    setIsUploading(true);
    const timestamp = new Date().toLocaleTimeString();
    
    try {
      console.log(`🚀 [${timestamp}] [WEB_UPLINK] Transformation en JSON et transfert...`);
      
      const uploadItems = [];
      
      for (const item of qaItems) {
        // 1. Document JSON principal
        uploadItems.push({
          id: `doc-${item.id}`,
          projectId: 'project-001',
          type: 'document' as const,
          content: JSON.stringify({ label: item.label, details: item.details, type: item.type }),
          tags: [item.type, item.label.substring(0, 15)],
          createdAt: new Date()
        });

        // 2. Assets associés
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
                  <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="SYMPTÔME..." className="h-32 bg-background font-code text-xs uppercase" />
                  <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="RÉSOLUTION..." className="h-32 bg-background font-code text-xs uppercase" />
                </div>
              ) : (
                <div className="space-y-4">
                  <Input value={procTitle} onChange={(e) => setProcTitle(e.target.value)} placeholder="TITRE PROCÉDURE" className="bg-background font-headline uppercase" />
                  {procSteps.map((step, index) => (
                    <Card key={step.id} className="p-4 border-border bg-black/30 space-y-4">
                      <div className="flex justify-between items-center border-b border-border/50 pb-2">
                        <span className="text-[10px] font-bold font-code text-secondary">ÉTAPE {index + 1}</span>
                        <Button variant="ghost" size="icon" onClick={() => setProcSteps(procSteps.filter(s => s.id !== step.id))} className="h-6 w-6 text-destructive"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Input placeholder="ACTION" value={step.title} onChange={(e) => { const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n); }} className="h-8 text-[11px] font-code uppercase" />
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1 h-8 text-[9px] font-code" onClick={(e) => handleTriggerCapture(e, index, 'image')}><Camera className="w-3 h-3 mr-2" /> PHOTO</Button>
                          <Button variant="outline" size="sm" className="flex-1 h-8 text-[9px] font-code" onClick={(e) => handleTriggerCapture(e, index, 'video')}><Video className="w-3 h-3 mr-2" /> VIDEO</Button>
                        </div>
                        {(step.imagePreview || step.videoPreview) && (
                          <div className="flex gap-2 items-center">
                            <Badge variant="outline" className="text-[8px] uppercase">Média attaché</Badge>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                  <Button type="button" variant="outline" onClick={() => setProcSteps([...procSteps, { id: Date.now().toString(), title: '', description: '', normalConditions: '', abnormalConditions: '', alarms: '' }])} className="w-full border-dashed h-9 text-[10px] uppercase font-code"><Plus className="w-3.5 h-3.5 mr-2" /> Ajouter Étape</Button>
                </div>
              )}
              <div className="flex justify-end">
                <Button type="submit" size="sm" className="font-headline font-bold uppercase text-[10px] h-9 px-8 bg-primary">Ajouter à la file</Button>
              </div>
            </form>
          </Card>

          {qaItems.length > 0 && (
            <div className="space-y-4 pb-12">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> File d'attente ({qaItems.length})</h3>
                <Button onClick={handleFinalSubmitToWebBDD} disabled={isUploading} className="bg-primary text-[10px] uppercase font-bold h-9 px-6">
                  {isUploading ? <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5 mr-2" />} 
                  Uplink vers BDD Web (JSON)
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {qaItems.map((item) => (
                  <Card key={item.id} className="p-3 border-border bg-black/20 font-code text-[9px] flex justify-between items-center rounded-sm">
                    <div className="truncate flex items-center gap-3">
                      <Badge variant="outline" className="text-[8px]">{item.type === 'procedure' ? 'PROCÉDURE' : 'Q/R'}</Badge>
                      <span className="text-muted-foreground uppercase">{item.label}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setQaItems(qaItems.filter(i => i.id !== item.id))} className="h-7 w-7"><Trash2 className="w-3 h-3 text-destructive" /></Button>
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
              <Button onClick={capturePhoto} className="h-14 w-14 rounded-full bg-primary shadow-2xl border-4 border-background"><Camera className="w-6 h-6" /></Button>
            ) : (
              <Button onClick={toggleRecording} className={cn("h-14 w-14 rounded-full shadow-2xl border-4 border-background", isRecording ? "bg-red-600 animate-pulse" : "bg-secondary")}><Video className="w-6 h-6" /></Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
