
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Database, 
  Plus, 
  UploadCloud, 
  Layers,
  Mic,
  Loader2,
  Trash2,
  Camera,
  Video as VideoIcon,
  HardDrive,
  FileText
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
  title: string;
  label: string;
  details: string;
}

export default function DatasetPage() {
  const { toast } = useToast();
  
  // 1. Hooks au sommet (Stabilité React 19)
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'qa' | 'procedure'>('qa');
  const [qaItems, setQaItems] = useState<QAItem[]>([]);
  
  // Q/A states
  const [qaTitle, setQaTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  
  // Procedure states
  const [procTitle, setProcTitle] = useState('');
  const [procSteps, setProcSteps] = useState<ProcedureStep[]>([
    { id: '1', title: '', duration: '', description: '', conditions: '', alarms: '', images: '', video: '' }
  ]);
  
  const [isUploading, setIsUploading] = useState(false);
  const [activeUIField, setActiveUIField] = useState<{ type: string, index?: number } | null>(null);
  
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
  const activeVoiceFieldRef = useRef<{ type: string, index?: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    activeVoiceFieldRef.current = activeUIField;
  }, [activeUIField]);

  const handleVoiceResult = useCallback((text: string) => {
    const target = activeVoiceFieldRef.current;
    if (!target) return;

    if (target.type === 'qaTitle') setQaTitle(p => p ? `${p} ${text}` : text);
    else if (target.type === 'question') setQuestion(p => p ? `${p} ${text}` : text);
    else if (target.type === 'answer') setAnswer(p => p ? `${p} ${text}` : text);
    else if (target.type === 'procTitle') setProcTitle(p => p ? `${p} ${text}` : text);
    else if (typeof target.index === 'number') {
      setProcSteps(prev => {
        const next = [...prev];
        const s = { ...next[target.index!] };
        if (target.type === 'stepTitle') s.title = s.title ? `${s.title} ${text}` : text;
        else if (target.type === 'stepDescription') s.description = s.description ? `${s.description} ${text}` : text;
        else if (target.type === 'stepConditions') s.conditions = s.conditions ? `${s.conditions} ${text}` : text;
        else if (target.type === 'stepAlarms') s.alarms = s.alarms ? `${s.alarms} ${text}` : text;
        next[target.index!] = s;
        return next;
      });
    }
  }, []);

  const voice = useVoice({ onResult: handleVoiceResult, autoRestart: false });

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    if (mediaModal.isOpen) {
      navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: mediaModal.type === 'video' 
      })
      .then(s => {
        currentStream = s;
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((err) => {
        toast({ title: "Erreur Caméra", description: "Accès refusé ou matériel occupé.", variant: "destructive" });
        setMediaModal(p => ({ ...p, isOpen: false }));
      });
    }
    return () => {
      if (currentStream) currentStream.getTracks().forEach(t => t.stop());
    };
  }, [mediaModal.isOpen, mediaModal.type, toast]);

  const toggleVoice = (type: string, index?: number) => {
    if (voice.isListening && activeUIField?.type === type && activeUIField?.index === index) {
      voice.stopListening();
      setActiveUIField(null);
    } else {
      setActiveUIField({ type, index });
      voice.startListening();
    }
  };

  const captureImage = () => {
    if (!videoRef.current || mediaModal.stepIndex === null) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    const n = [...procSteps];
    n[mediaModal.stepIndex].images = `IMG_PHYSICAL_${Date.now()}`;
    setProcSteps(n);
    setMediaModal(p => ({ ...p, isOpen: false }));
    toast({ title: "Frame capturée physiquement" });
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const rec = new MediaRecorder(streamRef.current);
    rec.ondataavailable = e => chunksRef.current.push(e.data);
    rec.onstop = () => {
      const n = [...procSteps];
      if (mediaModal.stepIndex !== null) {
        n[mediaModal.stepIndex].video = `VID_PHYSICAL_${Date.now()}`;
        setProcSteps(n);
      }
    };
    rec.start();
    mediaRecorderRef.current = rec;
    setIsCapturing(true);
    const itv = setInterval(() => setRecordingTime(t => t + 1), 1000);
    (rec as any)._interval = itv;
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      clearInterval((mediaRecorderRef.current as any)._interval);
      setIsCapturing(false);
      setMediaModal(p => ({ ...p, isOpen: false }));
      toast({ title: "Séquence vidéo enregistrée" });
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'qa') {
      if (!question.trim() || !answer.trim()) return;
      const finalTitle = qaTitle.trim() || `qa-${Date.now()}`;
      setQaItems(p => [{ id: `qa-${Date.now()}`, type: 'qa', title: finalTitle, label: question, details: answer }, ...p]);
      setQuestion(''); setAnswer(''); setQaTitle('');
    } else {
      if (!procTitle.trim()) return;
      const details = procSteps.map((s, i) => `[ETAPE ${i+1}] ${s.title}\nDESC: ${s.description}\nCOND: ${s.conditions}\nALARM: ${s.alarms}`).join('\n\n');
      setQaItems(p => [{ id: `proc-${Date.now()}`, type: 'procedure', title: procTitle, label: procTitle, details }, ...p]);
      setProcTitle('');
      setProcSteps([{ id: '1', title: '', duration: '', description: '', conditions: '', alarms: '', images: '', video: '' }]);
    }
    toast({ title: "Ajouté au registre provisoire" });
  };

  const handleFinalSubmit = async () => {
    setIsUploading(true);
    try {
      const items = qaItems.map(it => ({
        id: it.id,
        projectId: 'project-001',
        type: 'document',
        content: JSON.stringify({ 
          label: it.label, 
          details: it.details, 
          title: it.title,
          type: it.type,
          ingested_at: new Date().toISOString()
        }),
        tags: [it.type],
        createdAt: new Date().toISOString()
      }));
      await apiClient.post('/api/sync/upload', { userId: 'admin', projectId: 'project-001', items });
      toast({ title: "Fichiers JSON générés", description: "Vérifiez registry/items/ pour les Q/R complètes." });
      setQaItems([]);
    } catch (e) {
      toast({ title: "Échec Sync Physique", variant: "destructive" });
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
            <Database className="w-4 h-4 text-primary" />
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Capture RAG Physique</span>
          </div>
          <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
            <button onClick={() => setMode('qa')} className={cn("px-3 py-1 text-[9px] uppercase rounded-sm", mode === 'qa' ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground")}>FAQ</button>
            <button onClick={() => setMode('procedure')} className={cn("px-3 py-1 text-[9px] uppercase rounded-sm", mode === 'procedure' ? "bg-secondary text-secondary-foreground font-bold" : "text-muted-foreground")}>Procédure</button>
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-5xl mx-auto w-full space-y-8">
          <Card className="p-6 border-border bg-card/50 space-y-6 shadow-2xl">
            <form onSubmit={handleAddItem} className="space-y-6">
              {mode === 'qa' ? (
                <div className="space-y-6">
                  <div className="relative">
                    <p className="text-[10px] font-bold text-primary mb-2 uppercase flex items-center gap-2"><FileText className="w-3 h-3" /> Titre / Nom de référence (Génère le nom du fichier)</p>
                    <Input 
                      value={qaTitle} 
                      onChange={(e) => setQaTitle(e.target.value)} 
                      placeholder="EX: PANNE_POMPE_P01"
                      className={cn("bg-background font-code uppercase h-10", activeUIField?.type === 'qaTitle' && "ring-1 ring-red-500")} 
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('qaTitle')} className="absolute top-8 right-2 h-7 w-7"><Mic className="w-3.5 h-3.5" /></Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <p className="text-[10px] font-bold text-primary mb-2 uppercase">Question / Symptôme</p>
                      <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} className={cn("h-32 bg-background font-code text-xs", activeUIField?.type === 'question' && "ring-1 ring-red-500 animate-pulse")} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('question')} className="absolute top-8 right-2 h-7 w-7"><Mic className="w-3.5 h-3.5" /></Button>
                    </div>
                    <div className="relative">
                      <p className="text-[10px] font-bold text-secondary mb-2 uppercase">Réponse / Action</p>
                      <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} className={cn("h-32 bg-background font-code text-xs", activeUIField?.type === 'answer' && "ring-1 ring-red-500 animate-pulse")} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('answer')} className="absolute top-8 right-2 h-7 w-7 text-secondary"><Mic className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="relative">
                    <p className="text-[10px] font-bold text-primary mb-2 uppercase">Titre de la procédure</p>
                    <Input value={procTitle} onChange={(e) => setProcTitle(e.target.value)} className={cn("bg-background uppercase h-12 text-sm font-bold", activeUIField?.type === 'procTitle' && "ring-1 ring-red-500")} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('procTitle')} className="absolute top-8 right-2 h-7 w-7"><Mic className="w-3.5 h-3.5" /></Button>
                  </div>
                  <div className="space-y-4">
                    {procSteps.map((step, index) => (
                      <Card key={step.id} className="p-4 border-border bg-black/30 space-y-4 relative">
                        <div className="flex justify-between items-center border-b border-border/50 pb-2">
                          <span className="text-[10px] font-bold text-secondary uppercase">Action {index + 1}</span>
                          <div className="flex gap-2">
                             <Input placeholder="DURÉE" value={step.duration} onChange={(e) => { const n = [...procSteps]; n[index].duration = e.target.value; setProcSteps(n); }} className="h-7 w-24 text-[9px]" />
                             <Button type="button" variant="ghost" size="icon" onClick={() => setProcSteps(prev => prev.filter(s => s.id !== step.id))} className="h-7 w-7 text-muted-foreground hover:text-destructive" disabled={procSteps.length <= 1}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="relative">
                             <p className="text-[8px] font-bold uppercase text-muted-foreground mb-1">Action</p>
                             <Input value={step.title} onChange={(e) => { const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n); }} className={cn("h-8 text-[10px]", activeUIField?.type === 'stepTitle' && activeUIField.index === index && "ring-1 ring-red-500")} />
                             <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepTitle', index)} className="absolute top-5 right-1 h-7 w-7"><Mic className="w-3 h-3" /></Button>
                          </div>
                          <div className="relative">
                             <p className="text-[8px] font-bold uppercase text-muted-foreground mb-1">Description</p>
                             <Input value={step.description} onChange={(e) => { const n = [...procSteps]; n[index].description = e.target.value; setProcSteps(n); }} className={cn("h-8 text-[10px]", activeUIField?.type === 'stepDescription' && activeUIField.index === index && "ring-1 ring-red-500")} />
                             <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepDescription', index)} className="absolute top-5 right-1 h-7 w-7"><Mic className="w-3 h-3" /></Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="relative">
                             <p className="text-[8px] font-bold uppercase text-primary mb-1">Conditions</p>
                             <Input value={step.conditions} onChange={(e) => { const n = [...procSteps]; n[index].conditions = e.target.value; setProcSteps(n); }} className={cn("h-8 text-[10px]", activeUIField?.type === 'stepConditions' && activeUIField.index === index && "ring-1 ring-red-500")} />
                             <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepConditions', index)} className="absolute top-5 right-1 h-7 w-7 text-primary"><Mic className="w-3 h-3" /></Button>
                          </div>
                          <div className="relative">
                             <p className="text-[8px] font-bold uppercase text-destructive mb-1">Alarmes</p>
                             <Input value={step.alarms} onChange={(e) => { const n = [...procSteps]; n[index].alarms = e.target.value; setProcSteps(n); }} className={cn("h-8 text-[10px]", activeUIField?.type === 'stepAlarms' && activeUIField.index === index && "ring-1 ring-red-500")} />
                             <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepAlarms', index)} className="absolute top-5 right-1 h-7 w-7 text-destructive"><Mic className="w-3 h-3" /></Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/20">
                          <div className="flex gap-1 items-end">
                            <div className="flex-1">
                              <p className="text-[8px] font-bold uppercase text-secondary mb-1">Image Ref</p>
                              <Input value={step.images} readOnly className="h-8 text-[9px] bg-secondary/5 font-code" />
                            </div>
                            <Button type="button" variant="secondary" size="icon" onClick={() => setMediaModal({ isOpen: true, type: 'image', stepIndex: index })} className="h-8 w-8"><Camera className="w-4 h-4" /></Button>
                          </div>
                          <div className="flex gap-1 items-end">
                            <div className="flex-1">
                              <p className="text-[8px] font-bold uppercase text-secondary mb-1">Vidéo Ref</p>
                              <Input value={step.video} readOnly className="h-8 text-[9px] bg-secondary/5 font-code" />
                            </div>
                            <Button type="button" variant="secondary" size="icon" onClick={() => setMediaModal({ isOpen: true, type: 'video', stepIndex: index })} className="h-8 w-8"><VideoIcon className="w-4 h-4" /></Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                  <Button type="button" variant="outline" onClick={() => setProcSteps([...procSteps, { id: Date.now().toString(), title: '', duration: '', description: '', conditions: '', alarms: '', images: '', video: '' }])} className="w-full border-dashed h-10 text-[10px] uppercase font-bold"><Plus className="w-3 h-3 mr-2" /> Ajouter une action de maintenance</Button>
                </div>
              )}
              <Button type="submit" className="w-full font-bold uppercase text-xs h-12 bg-primary text-primary-foreground shadow-lg">Ajouter au Registre Provisoire</Button>
            </form>
          </Card>

          {qaItems.length > 0 && (
            <div className="space-y-4 pb-12">
              <div className="flex justify-between items-center border-b border-border pb-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Layers className="w-3.5 h-3.5" /> Registre Provisoire ({qaItems.length})</h3>
                <Button onClick={handleFinalSubmit} disabled={isUploading} size="sm" className="bg-secondary text-secondary-foreground text-[9px] font-bold shadow-md">{isUploading ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <UploadCloud className="w-3 h-3 mr-2" />} Synchronisation Physique</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {qaItems.map(item => (
                  <Card key={item.id} className="p-4 border-border bg-card/20 relative group hover:border-primary/30 transition-all">
                    <Button variant="ghost" size="icon" onClick={() => setQaItems(prev => prev.filter(i => i.id !== item.id))} className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"><Trash2 className="w-3 h-3" /></Button>
                    <div className="flex items-center gap-2 mb-2"><span className={cn("w-1.5 h-1.5 rounded-full", item.type === 'qa' ? "bg-primary" : "bg-secondary")} /><p className="text-[10px] font-bold text-primary uppercase pr-8 truncate">{item.title}</p></div>
                    <p className="text-[9px] font-code text-muted-foreground line-clamp-3 italic bg-black/20 p-2 rounded-sm whitespace-pre-wrap">{item.label}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Dialog open={mediaModal.isOpen} onOpenChange={(o) => { if(!o) setMediaModal(p => ({...p, isOpen: false})); }}>
        <DialogContent className="sm:max-w-2xl bg-black border-primary/40 shadow-2xl">
          <DialogHeader><DialogTitle className="text-xs uppercase font-headline text-primary flex items-center gap-2">{mediaModal.type === 'image' ? <Camera className="w-4 h-4" /> : <VideoIcon className="w-4 h-4" />} Station de capture physique</DialogTitle></DialogHeader>
          <div className="relative aspect-video bg-muted/10 rounded-sm overflow-hidden border border-border">
            <video ref={videoRef} autoPlay playsInline muted={mediaModal.type === 'image'} className="w-full h-full object-cover" />
            {isCapturing && <div className="absolute top-4 right-4 bg-red-600 text-white px-2 py-1 rounded-sm text-[10px] font-code animate-pulse flex items-center gap-2"><div className="w-2 h-2 bg-white rounded-full" /> REC | {recordingTime}s</div>}
          </div>
          <div className="flex justify-center gap-4 mt-4">
            {mediaModal.type === 'image' ? (
              <Button onClick={captureImage} className="bg-primary text-primary-foreground font-bold uppercase text-[10px] px-8 h-10 shadow-lg">Capturer Frame</Button>
            ) : (
              !isCapturing ? <Button onClick={startRecording} className="bg-red-600 text-white font-bold uppercase text-[10px] px-8 h-10 shadow-lg">Lancer Enregistrement</Button> : <Button onClick={stopRecording} className="bg-white text-black font-bold uppercase text-[10px] px-8 h-10 shadow-lg">Arrêter & Sauver</Button>
            )}
            <Button variant="ghost" onClick={() => setMediaModal(p => ({...p, isOpen: false}))} className="text-[10px] uppercase font-bold text-muted-foreground">Annuler</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
