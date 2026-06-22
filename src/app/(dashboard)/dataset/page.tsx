"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Database, 
  Plus, 
  Trash2, 
  UploadCloud, 
  CheckCircle2,
  Cpu,
  ListOrdered,
  MessageSquare,
  Image as ImageIcon,
  Video,
  Layers,
  Camera,
  Eye,
  RefreshCw,
  Smartphone,
  X,
  Check,
  Loader2,
  AlertTriangle,
  Monitor,
  Circle
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
  DialogTitle,
  DialogFooter
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

  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestProgress, setIngestIngestProgress] = useState(0);
  
  // États pour la capture WebRTC réelle
  const [cameraOpen, setCameraModalOpen] = useState(false);
  const [cameraType, setCameraType] = useState<'image' | 'video'>('image');
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Inputs cachés pour le mode DESKTOP uniquement
  const desktopPhotoRef = useRef<HTMLInputElement>(null);
  const desktopVideoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      procSteps.forEach(s => {
        if (s.imagePreview) URL.revokeObjectURL(s.imagePreview);
        if (s.videoPreview) URL.revokeObjectURL(s.videoPreview);
      });
      if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    };
  }, [procSteps, cameraStream]);

  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 1000;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
          } else {
            if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Échec compression"));
          }, 'image/jpeg', 0.7);
        };
        img.onerror = () => reject(new Error("Erreur image"));
      };
      reader.onerror = () => reject(new Error("Erreur lecture"));
    });
  };

  const processCapturedFile = async (file: File, index: number, type: 'image' | 'video') => {
    try {
      const newSteps = [...procSteps];
      if (type === 'image') {
        const compressedBlob = await compressImage(file);
        const compressedFile = new File([compressedBlob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        if (newSteps[index].imagePreview) URL.revokeObjectURL(newSteps[index].imagePreview!);
        newSteps[index].imageFile = compressedFile;
        newSteps[index].imagePreview = URL.createObjectURL(compressedFile);
      } else {
        if (newSteps[index].videoPreview) URL.revokeObjectURL(newSteps[index].videoPreview!);
        newSteps[index].videoFile = file;
        newSteps[index].videoPreview = URL.createObjectURL(file);
      }
      setProcSteps(newSteps);
    } catch (err) {
      toast({ title: "Erreur Traitement", description: "Mémoire saturée.", variant: "destructive" });
    }
  };

  const handleTriggerCapture = (e: React.MouseEvent, index: number, type: 'image' | 'video') => {
    e.preventDefault();
    e.stopPropagation();
    setActiveStepIndex(index);
    
    if (isDesktop) {
      // Mode Desktop : Utilise les inputs fichiers standards
      if (type === 'image') desktopPhotoRef.current?.click();
      else desktopVideoRef.current?.click();
    } else {
      // Mode Web : Ouvre la caméra réelle via WebRTC
      setCameraType(type);
      setCameraModalOpen(true);
    }
  };

  // Gestion Caméra WebRTC
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: cameraType === 'video' 
      });
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      toast({ title: "Accès Caméra Refusé", description: "Vérifiez vos permissions navigateur.", variant: "destructive" });
      setCameraModalOpen(false);
    }
  };

  useEffect(() => {
    if (cameraOpen) {
      startCamera();
    } else {
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => track.stop());
        setCameraStream(null);
      }
    }
  }, [cameraOpen]);

  const capturePhoto = () => {
    if (!videoRef.current || activeStepIndex === null) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], `snap_${Date.now()}.jpg`, { type: 'image/jpeg' });
        await processCapturedFile(file, activeStepIndex, 'image');
        setCameraModalOpen(false);
      }
    }, 'image/jpeg', 0.9);
  };

  const toggleRecording = () => {
    if (!isRecording) {
      recordedChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(cameraStream!);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/mp4' });
        const file = new File([blob], `vid_${Date.now()}.mp4`, { type: 'video/mp4' });
        if (activeStepIndex !== null) await processCapturedFile(file, activeStepIndex, 'video');
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
      setQaItems(prev => [{ id: Date.now().toString(), type: 'qa', label: question, details: answer }, ...prev]);
      setQuestion(''); setAnswer('');
    } else {
      if (!procTitle.trim()) return;
      const details = procSteps.map((s, i) => (
        `[ÉTAPE ${i + 1}] ${s.title}\nDescription: ${s.description}\n✓ OK: ${s.normalConditions} | ✗ KO: ${s.abnormalConditions}`
      )).join('\n---\n');
      const assets = procSteps.flatMap((s, idx) => {
        const items = [];
        if (s.imageFile) items.push({ type: 'image' as const, file: s.imageFile, step: idx });
        if (s.videoFile) items.push({ type: 'video' as const, file: s.videoFile, step: idx });
        return items;
      });
      setQaItems(prev => [{ id: Date.now().toString(), type: 'procedure', label: procTitle, details, mediaAssets: assets }, ...prev]);
      setProcTitle('');
      setProcSteps([{ id: '1', title: '', description: '', normalConditions: '', abnormalConditions: '', alarms: '' }]);
    }
  };

  const handleFinalSubmit = async () => {
    if (qaItems.length === 0) return;
    setIsIngesting(true);
    setIngestIngestProgress(0);
    try {
      await apiClient.post('/api/vector/ingest', {
        items: qaItems.map(i => ({ question: i.label, answer: i.details })),
        metadata: { collection: 'industrial_manuals' }
      });
      // Upload des assets lourds un par un
      const itemsWithAssets = qaItems.filter(i => i.mediaAssets?.length);
      for (const item of itemsWithAssets) {
        for (const asset of item.mediaAssets!) {
          const reader = new FileReader();
          const base64 = await new Promise<string>((res) => {
            reader.onload = () => res(reader.result as string);
            reader.readAsDataURL(asset.file);
          });
          await apiClient.post('/api/sync/upload', {
            userId: 'admin', projectId: 'project-001',
            items: [{ id: `asset-${Date.now()}`, type: 'provisional_asset', content: base64, metadata: { type: asset.type, title: item.label }, createdAt: new Date() }]
          });
        }
      }
      toast({ title: "Succès", description: "Données synchronisées." });
      setQaItems([]);
    } catch (e) {
      toast({ title: "Erreur", description: "Liaison perdue.", variant: "destructive" });
    } finally {
      setIsIngesting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      
      {/* Inputs cachés pour le mode DESKTOP (Importation fichier) */}
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
            <Badge variant="outline" className="hidden sm:flex text-[9px] border-secondary/30 text-secondary">
              {isDesktop ? "STATION_IMPORT_ACTIVE" : "VISION_LIVE_ACTIVE"}
            </Badge>
          </div>
          <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
            <button onClick={() => setMode('qa')} className={cn("px-3 py-1.5 text-[9px] font-code uppercase rounded-sm", mode === 'qa' ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>Q / R</button>
            <button onClick={() => setMode('procedure')} className={cn("px-3 py-1.5 text-[9px] font-code uppercase rounded-sm", mode === 'procedure' ? "bg-secondary text-secondary-foreground" : "text-muted-foreground")}>Procédure</button>
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
          <Card className="p-4 lg:p-6 border-border bg-card/50 space-y-6 rounded-sm shadow-2xl">
            <form onSubmit={handleAddItem} className="space-y-6">
              {mode === 'qa' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase text-muted-foreground ml-1">Question</label>
                    <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="SYMPTÔME..." className="h-32 bg-background font-code text-xs uppercase" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase text-muted-foreground ml-1">Réponse</label>
                    <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="SOLUTION..." className="h-32 bg-background font-code text-xs uppercase" />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <Input value={procTitle} onChange={(e) => setProcTitle(e.target.value)} placeholder="TITRE_DE_LA_PROCÉDURE" className="bg-background font-headline uppercase h-11" />
                  {procSteps.map((step, index) => (
                    <Card key={step.id} className="p-4 border-border bg-black/30 space-y-4">
                      <div className="flex justify-between items-center border-b border-border/50 pb-2">
                        <span className="text-[10px] font-bold font-code text-secondary">ÉTAPE {index + 1}</span>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setProcSteps(procSteps.filter(s => s.id !== step.id))} className="h-6 w-6 text-destructive"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="space-y-3">
                          <Input placeholder="ACTION" value={step.title} onChange={(e) => {
                            const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n);
                          }} className="h-8 text-[11px] font-code uppercase bg-background" />
                          <Textarea placeholder="DESCRIPTION" value={step.description} onChange={(e) => {
                            const n = [...procSteps]; n[index].description = e.target.value; setProcSteps(n);
                          }} className="text-[10px] uppercase font-code bg-background min-h-[80px]" />
                        </div>
                        <div className="space-y-3">
                          <Input value={step.normalConditions} placeholder="✓ ÉTAT NORMAL" onChange={(e) => {
                            const n = [...procSteps]; n[index].normalConditions = e.target.value; setProcSteps(n);
                          }} className="h-8 text-[9px] font-code bg-background/30" />
                          <Input value={step.abnormalConditions} placeholder="✗ ANOMALIE" onChange={(e) => {
                            const n = [...procSteps]; n[index].abnormalConditions = e.target.value; setProcSteps(n);
                          }} className="h-8 text-[9px] font-code bg-background/30" />
                        </div>
                        <div className="bg-black/20 p-3 rounded-sm border border-border/30">
                          <p className="text-[8px] font-bold uppercase text-muted-foreground mb-3">Documentation Visuelle</p>
                          <div className="flex gap-2 mb-3">
                            <Button type="button" variant="outline" size="sm" className="flex-1 h-8 text-[9px] font-code uppercase" onClick={(e) => handleTriggerCapture(e, index, 'image')}>
                              <Camera className="w-3 h-3 mr-2" /> {isDesktop ? "IMPORT_PC" : "PHOTO_CAM"}
                            </Button>
                            <Button type="button" variant="outline" size="sm" className="flex-1 h-8 text-[9px] font-code uppercase" onClick={(e) => handleTriggerCapture(e, index, 'video')}>
                              <Video className="w-3 h-3 mr-2" /> {isDesktop ? "FICHIER" : "VIDÉO_CAM"}
                            </Button>
                          </div>
                          <div className="space-y-1">
                            {step.imagePreview && (
                              <div className="flex items-center justify-between p-1.5 bg-background/40 rounded-sm">
                                <span className="text-[8px] font-code text-primary uppercase truncate"><ImageIcon className="w-2.5 h-2.5 mr-1 inline" /> Image_Ok</span>
                                <button type="button" onClick={() => {
                                  const n = [...procSteps]; n[index].imageFile = undefined; n[index].imagePreview = undefined; setProcSteps(n);
                                }} className="text-destructive"><X className="w-2.5 h-2.5" /></button>
                              </div>
                            )}
                            {step.videoPreview && (
                              <div className="flex items-center justify-between p-1.5 bg-background/40 rounded-sm">
                                <span className="text-[8px] font-code text-secondary uppercase truncate"><Video className="w-2.5 h-2.5 mr-1 inline" /> Séquence_Ok</span>
                                <button type="button" onClick={() => {
                                  const n = [...procSteps]; n[index].videoFile = undefined; n[index].videoPreview = undefined; setProcSteps(n);
                                }} className="text-destructive"><X className="w-2.5 h-2.5" /></button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                  <Button type="button" variant="outline" onClick={() => setProcSteps([...procSteps, { id: Date.now().toString(), title: '', description: '', normalConditions: '', abnormalConditions: '', alarms: '' }])} className="w-full border-dashed h-9 text-[10px] uppercase font-code"><Plus className="w-3.5 h-3.5 mr-2" /> Ajouter une Étape</Button>
                </div>
              )}
              <div className="flex justify-end pt-4">
                <Button type="submit" size="sm" className={cn("font-headline font-bold uppercase text-[10px] h-9 px-8", mode === 'qa' ? "bg-primary" : "bg-secondary")}>Ajouter à la file d'attente</Button>
              </div>
            </form>
          </Card>

          {qaItems.length > 0 && (
            <div className="space-y-4 pb-12">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> File d'attente ({qaItems.length})</h3>
                <Button onClick={handleFinalSubmit} disabled={isIngesting} className="bg-primary text-[10px] uppercase font-bold h-9 px-6 animate-pulse">
                  {isIngesting ? <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5 mr-2" />} Synchroniser vers le Moteur
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {qaItems.map((item) => (
                  <Card key={item.id} className="p-3 border-border bg-black/20 font-code text-[9px] flex justify-between items-center rounded-sm">
                    <div className="truncate">
                      <span className={cn("font-bold mr-2 uppercase", item.type === 'procedure' ? "text-secondary" : "text-primary")}>{item.type === 'procedure' ? 'PROCÉDURE' : 'Q/R'}:</span> 
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

      {/* MODAL CAMÉRA WebRTC (Mode Web uniquement) */}
      <Dialog open={cameraOpen} onOpenChange={setCameraModalOpen}>
        <DialogContent className="max-w-xl bg-card border-primary/30 p-0 sm:rounded-sm overflow-hidden">
          <div className="relative aspect-video bg-black flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <div className="absolute inset-0 pointer-events-none border-[12px] border-primary/5 opacity-30" />
            {isRecording && <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600 px-2 py-1 rounded-full animate-pulse text-[10px] font-bold text-white uppercase"><Circle className="w-3 h-3 fill-white" /> Rec</div>}
          </div>
          <div className="p-4 flex items-center justify-center gap-6 bg-card/90">
            <Button variant="ghost" onClick={() => setCameraModalOpen(false)} className="text-muted-foreground text-[10px] uppercase font-code">Annuler</Button>
            {cameraType === 'image' ? (
              <Button onClick={capturePhoto} className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-2xl border-4 border-background"><Camera className="w-6 h-6" /></Button>
            ) : (
              <Button onClick={toggleRecording} className={cn("h-14 w-14 rounded-full shadow-2xl border-4 border-background", isRecording ? "bg-red-600 animate-pulse" : "bg-secondary")}><Video className="w-6 h-6" /></Button>
            )}
            <div className="w-[60px]" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
