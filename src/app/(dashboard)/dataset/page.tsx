"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Database, 
  Plus, 
  Trash2, 
  UploadCloud, 
  Layers,
  Camera,
  Video,
  RefreshCw,
  Loader2,
  Mic,
  MicOff,
  Activity,
  ShieldAlert,
  Bell,
  Clock,
  Sparkles
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent 
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
  duration: string;
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
  const [isGuideActive, setIsGuideActive] = useState(false);
  
  const activeVoiceFieldRef = useRef<{ type: string, index?: number } | null>(null);
  const [activeVoiceField, setActiveVoiceField] = useState<{ type: string, index?: number } | null>(null);

  const { isListening, isSupported, startListening, stopListening, speak } = useVoice({
    onResult: (text) => {
      const target = activeVoiceFieldRef.current;
      if (!target) {
        console.warn(`[DATASET_AUDIT] ⚠️ Aucun champ cible pour : "${text}"`);
        return;
      }

      console.log(`[DATASET_AUDIT] 🎯 Injection vers : ${target.type} ${target.index ?? ''}`);
      const cleanText = text.trim();

      if (target.type === 'question') {
        setQuestion(prev => prev ? `${prev} ${cleanText}` : cleanText);
      } else if (target.type === 'answer') {
        setAnswer(prev => prev ? `${prev} ${cleanText}` : cleanText);
      } else if (target.type === 'procTitle') {
        setProcTitle(prev => prev ? `${prev} ${cleanText}` : cleanText);
      } else if (typeof target.index === 'number') {
        setProcSteps(prev => {
          const next = [...prev];
          const s = { ...next[target.index!] };
          if (target.type === 'stepTitle') s.title = s.title ? `${s.title} ${cleanText}` : cleanText;
          else if (target.type === 'stepDesc') s.description = s.description ? `${s.description} ${cleanText}` : cleanText;
          else if (target.type === 'stepNormal') s.normalConditions = s.normalConditions ? `${s.normalConditions} ${cleanText}` : cleanText;
          else if (target.type === 'stepAbnormal') s.abnormalConditions = s.abnormalConditions ? `${s.abnormalConditions} ${cleanText}` : cleanText;
          else if (target.type === 'stepAlarms') s.alarms = s.alarms ? `${s.alarms} ${cleanText}` : cleanText;
          else if (target.type === 'stepDuration') s.duration = s.duration ? `${s.duration} ${cleanText}` : cleanText;
          next[target.index!] = s;
          return next;
        });
      }
    }
  });

  const toggleVoice = (type: string, index?: number) => {
    const target = { type, index };
    const isActive = isListening && activeVoiceField?.type === type && activeVoiceField?.index === index;

    if (isActive) {
      stopListening();
      activeVoiceFieldRef.current = null;
      setActiveVoiceField(null);
    } else {
      if (isListening) stopListening();
      activeVoiceFieldRef.current = target;
      setActiveVoiceField(target);
      setTimeout(() => startListening(), 50);
    }
  };

  const [cameraOpen, setCameraModalOpen] = useState(false);
  const [cameraType, setCameraType] = useState<'image' | 'video'>('image');
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const desktopPhotoRef = useRef<HTMLInputElement>(null);
  const desktopVideoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
    };
  }, [cameraStream]);

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

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'qa') {
      if (!question.trim() || !answer.trim()) return;
      setQaItems([{ id: Date.now().toString(), type: 'qa', label: question, details: answer }, ...qaItems]);
      setQuestion(''); setAnswer('');
    } else {
      if (!procTitle.trim()) return;
      const details = procSteps.map((s, i) => `[ÉTAPE ${i + 1}] ${s.title}\nDurée: ${s.duration || 'Indéfinie'}\nDesc: ${s.description}`).join('\n');
      setQaItems([{ id: Date.now().toString(), type: 'procedure', label: procTitle, details }, ...qaItems]);
      setProcTitle('');
      setProcSteps([{ id: Date.now().toString(), title: '', description: '', normalConditions: '', abnormalConditions: '', alarms: '', duration: '' }]);
    }
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
      toast({ title: "Transfert Réussi", description: "Données envoyées au registre cloud." });
      setQaItems([]);
    } catch (e) {
      toast({ title: "Échec Transfert", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      <input type="file" accept="image/*" ref={desktopPhotoRef} className="hidden" />
      <input type="file" accept="video/*" ref={desktopVideoRef} className="hidden" />

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto terminal-scroll">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <Database className="w-4 h-4 text-primary animate-pulse" />
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Base RAG</span>
          </div>

          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setIsGuideActive(!isGuideActive);
                if (!isGuideActive) speak("Assistant de saisie activé.");
              }}
              className={cn("h-9 text-[9px] font-code uppercase", isGuideActive ? "text-secondary" : "text-muted-foreground")}
            >
              <Sparkles className="w-3.5 h-3.5 mr-2" />
              {isGuideActive ? "IA Active" : "IA OFF"}
            </Button>
            <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
              <button onClick={() => setMode('qa')} className={cn("px-3 py-1 text-[9px] uppercase rounded-sm", mode === 'qa' ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>Q/R</button>
              <button onClick={() => setMode('procedure')} className={cn("px-3 py-1 text-[9px] uppercase rounded-sm", mode === 'procedure' ? "bg-secondary text-secondary-foreground" : "text-muted-foreground")}>Procédure</button>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
          <Card className="p-6 border-border bg-card/50 space-y-6 rounded-sm">
            <form onSubmit={handleAddItem} className="space-y-6">
              {mode === 'qa' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative group">
                    <Textarea 
                      value={question} 
                      onChange={(e) => setQuestion(e.target.value)} 
                      placeholder="SYMPTÔME..." 
                      className={cn("h-32 bg-background font-code text-xs uppercase pr-10", activeVoiceField?.type === 'question' && "ring-2 ring-red-500")}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('question')} className="absolute top-2 right-2 h-7 w-7 text-primary">
                      {activeVoiceField?.type === 'question' && isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                  <div className="relative group">
                    <Textarea 
                      value={answer} 
                      onChange={(e) => setAnswer(e.target.value)} 
                      placeholder="RÉSOLUTION..." 
                      className={cn("h-32 bg-background font-code text-xs uppercase pr-10", activeVoiceField?.type === 'answer' && "ring-2 ring-red-500")}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('answer')} className="absolute top-2 right-2 h-7 w-7 text-primary">
                      {activeVoiceField?.type === 'answer' && isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative group">
                    <Input value={procTitle} onChange={(e) => setProcTitle(e.target.value)} placeholder="TITRE PROCÉDURE" className={cn("bg-background uppercase", activeVoiceField?.type === 'procTitle' && "ring-2 ring-red-500")} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('procTitle')} className="absolute top-1.5 right-2 h-7 w-7 text-primary">
                      {activeVoiceField?.type === 'procTitle' && isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                  {procSteps.map((step, index) => (
                    <Card key={step.id} className="p-4 border-border bg-black/30 space-y-4">
                      <div className="flex justify-between items-center border-b border-border/50 pb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-secondary">ÉTAPE {index + 1}</span>
                          <div className="relative">
                            <Input 
                              placeholder="DURÉE..." 
                              value={step.duration} 
                              onChange={(e) => { const n = [...procSteps]; n[index].duration = e.target.value; setProcSteps(n); }} 
                              className={cn("h-6 w-32 text-[9px] bg-background/20", activeVoiceField?.type === 'stepDuration' && activeVoiceField?.index === index && "ring-1 ring-red-500")}
                            />
                            <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepDuration', index)} className="absolute right-0 top-0 h-6 w-6"><Mic className="w-2.5 h-2.5" /></Button>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setProcSteps(procSteps.filter(s => s.id !== step.id))}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                      <div className="space-y-4">
                        <div className="relative group">
                          <Input 
                            placeholder="TITRE ACTION" 
                            value={step.title} 
                            onChange={(e) => { const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n); }} 
                            className={cn("h-9 text-[11px] uppercase", activeVoiceField?.type === 'stepTitle' && activeVoiceField?.index === index && "ring-2 ring-red-500")}
                          />
                          <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepTitle', index)} className="absolute top-1 right-2 h-7 w-7"><Mic className="w-3.5 h-3.5" /></Button>
                        </div>
                        <div className="relative group">
                          <Textarea 
                            placeholder="DESCRIPTION..." 
                            value={step.description} 
                            onChange={(e) => { const n = [...procSteps]; n[index].description = e.target.value; setProcSteps(n); }} 
                            className={cn("h-20 bg-background/50 font-code text-[11px] uppercase", activeVoiceField?.type === 'stepDesc' && activeVoiceField?.index === index && "ring-2 ring-red-500")}
                          />
                          <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepDesc', index)} className="absolute top-2 right-2 h-7 w-7"><Mic className="w-3.5 h-3.5" /></Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1 relative">
                            <span className="text-[8px] font-bold text-secondary uppercase">Nominal</span>
                            <Input placeholder="ÉTAT..." value={step.normalConditions} onChange={(e) => { const n = [...procSteps]; n[index].normalConditions = e.target.value; setProcSteps(n); }} className="h-7 text-[9px]" />
                            <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepNormal', index)} className="absolute bottom-0 right-0 h-7 w-7"><Mic className="w-2.5 h-2.5" /></Button>
                          </div>
                          <div className="space-y-1 relative">
                            <span className="text-[8px] font-bold text-primary uppercase">Anormal</span>
                            <Input placeholder="DÉRIVE..." value={step.abnormalConditions} onChange={(e) => { const n = [...procSteps]; n[index].abnormalConditions = e.target.value; setProcSteps(n); }} className="h-7 text-[9px]" />
                            <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepAbnormal', index)} className="absolute bottom-0 right-0 h-7 w-7"><Mic className="w-2.5 h-2.5" /></Button>
                          </div>
                          <div className="space-y-1 relative">
                            <span className="text-[8px] font-bold text-destructive uppercase">Alarmes</span>
                            <Input placeholder="SEUILS..." value={step.alarms} onChange={(e) => { const n = [...procSteps]; n[index].alarms = e.target.value; setProcSteps(n); }} className="h-7 text-[9px]" />
                            <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('stepAlarms', index)} className="absolute bottom-0 right-0 h-7 w-7"><Mic className="w-2.5 h-2.5" /></Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                  <Button type="button" variant="outline" onClick={() => setProcSteps([...procSteps, { id: Date.now().toString(), title: '', description: '', normalConditions: '', abnormalConditions: '', alarms: '', duration: '' }])} className="w-full border-dashed h-9 text-[10px] uppercase font-code">
                    <Plus className="w-3.5 h-3.5 mr-2" /> Ajouter Étape
                  </Button>
                </div>
              )}
              <div className="flex justify-end pt-4 border-t border-border/50">
                <Button type="submit" size="sm" className="font-headline font-bold uppercase text-[10px] h-10 px-8 bg-primary">Ajouter File d'attente</Button>
              </div>
            </form>
          </Card>

          {qaItems.length > 0 && (
            <div className="space-y-4 pb-12">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> File d'attente ({qaItems.length})</h3>
                <Button onClick={handleFinalSubmit} disabled={isUploading} className="bg-primary text-[10px] uppercase font-bold h-9">
                  {isUploading ? <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5 mr-2" />} 
                  Sync Registre Cloud
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {qaItems.map((item) => (
                  <Card key={item.id} className="p-3 border-border bg-black/20 font-code text-[9px] flex justify-between items-center rounded-sm">
                    <div className="truncate flex items-center gap-3">
                      <Badge variant="outline" className="text-[8px] py-0 px-1.5">{item.type.toUpperCase()}</Badge>
                      <span className="text-muted-foreground uppercase truncate">{item.label}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setQaItems(qaItems.filter(i => i.id !== item.id))} className="h-7 w-7 text-muted-foreground"><Trash2 className="w-3 h-3" /></Button>
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
