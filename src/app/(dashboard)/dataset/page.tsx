"use client";

import { useState, useRef, useEffect } from 'react';
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
  AlertTriangle
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

  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestProgress, setIngestIngestProgress] = useState(0);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const activeCaptureRef = useRef<{ index: number, type: 'image' | 'video' } | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      // Nettoyage radical des ressources mémoire
      procSteps.forEach(s => {
        if (s.imagePreview) URL.revokeObjectURL(s.imagePreview);
        if (s.videoPreview) URL.revokeObjectURL(s.videoPreview);
      });
    };
  }, []);

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
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Compression failed"));
          }, 'image/jpeg', 0.7);
        };
        img.onerror = () => reject(new Error("Image load error"));
      };
      reader.onerror = () => reject(new Error("File read error"));
    });
  };

  const fileToBase64 = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const addStep = () => {
    setProcSteps([...procSteps, { 
      id: Date.now().toString(), 
      title: '', description: '', normalConditions: '', abnormalConditions: '', alarms: '' 
    }]);
  };

  const removeStep = (index: number) => {
    if (procSteps.length <= 1) return;
    const newSteps = [...procSteps];
    const removed = newSteps.splice(index, 1)[0];
    if (removed.imagePreview) URL.revokeObjectURL(removed.imagePreview);
    if (removed.videoPreview) URL.revokeObjectURL(removed.videoPreview);
    setProcSteps(newSteps);
  };

  const updateStep = (index: number, field: keyof ProcedureStep, value: string) => {
    const newSteps = [...procSteps];
    (newSteps[index] as any)[field] = value;
    setProcSteps(newSteps);
  };

  const deleteMedia = (index: number, type: 'image' | 'video') => {
    const newSteps = [...procSteps];
    if (type === 'image') {
      if (newSteps[index].imagePreview) URL.revokeObjectURL(newSteps[index].imagePreview!);
      newSteps[index].imageFile = undefined;
      newSteps[index].imagePreview = undefined;
    } else {
      if (newSteps[index].videoPreview) URL.revokeObjectURL(newSteps[index].videoPreview!);
      newSteps[index].videoFile = undefined;
      newSteps[index].videoPreview = undefined;
    }
    setProcSteps(newSteps);
  };

  const handleTriggerCapture = (e: React.MouseEvent, index: number, type: 'image' | 'video') => {
    e.preventDefault();
    e.stopPropagation();
    activeCaptureRef.current = { index, type };
    if (type === 'image') photoInputRef.current?.click();
    else videoInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCaptureRef.current) return;

    const { index, type } = activeCaptureRef.current;
    setIsProcessingMedia(true);

    try {
      const newSteps = [...procSteps];
      if (type === 'image') {
        const compressedBlob = await compressImage(file);
        const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
        
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
      toast({ title: "Erreur Capture", description: "Mémoire saturée.", variant: "destructive" });
    } finally {
      setIsProcessingMedia(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'qa') {
      if (!question.trim() || !answer.trim()) {
        toast({ title: "Champs vides", description: "Veuillez remplir la question et la réponse.", variant: "destructive" });
        return;
      }
      setQaItems(prev => [{ id: Date.now().toString(), type: 'qa', label: question, details: answer }, ...prev]);
      setQuestion(''); setAnswer('');
    } else {
      if (!procTitle.trim()) {
        toast({ title: "Titre requis", description: "Veuillez nommer votre procédure.", variant: "destructive" });
        return;
      }
      
      const details = procSteps.map((s, i) => (
        `[ÉTAPE ${i + 1}] ${s.title}\nDescription: ${s.description}\n✓ OK: ${s.normalConditions} | ✗ KO: ${s.abnormalConditions} | ⚠ ALERTE: ${s.alarms}`
      )).join('\n---\n');

      const assets = procSteps.flatMap((s, idx) => {
        const items = [];
        if (s.imageFile) items.push({ type: 'image' as const, file: s.imageFile, step: idx });
        if (s.videoFile) items.push({ type: 'video' as const, file: s.videoFile, step: idx });
        return items;
      });

      setQaItems(prev => [{ id: Date.now().toString(), type: 'procedure', label: procTitle, details, mediaAssets: assets }, ...prev]);
      setProcTitle('');
      setProcSteps([{ id: Date.now().toString(), title: '', description: '', normalConditions: '', abnormalConditions: '', alarms: '' }]);
      toast({ title: "Procédure ajoutée", description: "Prête pour la synchronisation." });
    }
  };

  const handleFinalSubmit = async () => {
    if (qaItems.length === 0) return;
    setIsIngesting(true);
    setIngestIngestProgress(0);

    try {
      // 1. Ingestion du Texte (Métadonnées)
      const ingestRes = await apiClient.post<{ success: boolean, provider: string }>('/api/vector/ingest', {
        items: qaItems.map(i => ({ 
          question: i.type === 'procedure' ? `PROCÉDURE: ${i.label}` : i.label, 
          answer: i.details 
        })),
        metadata: { collection: 'industrial_manuals', source: isDesktop ? 'STATION_FORGE' : 'CAPTURE_TERRAIN' }
      });

      // 2. Upload ATOMIQUE et SÉQUENTIEL des Assets
      const itemsWithAssets = qaItems.filter(i => i.mediaAssets && i.mediaAssets.length > 0);
      let totalAssets = itemsWithAssets.reduce((acc, curr) => acc + (curr.mediaAssets?.length || 0), 0);
      let uploadedCount = 0;

      for (const item of itemsWithAssets) {
        for (const asset of item.mediaAssets!) {
          // Conversion tardive (Base64) UNIQUEMENT pour cet asset précis
          const base64 = await fileToBase64(asset.file);
          
          await apiClient.post('/api/sync/upload', {
            userId: 'admin',
            projectId: 'project-001',
            items: [{
              id: `asset-${Date.now()}-${Math.random()}`,
              projectId: 'project-001',
              type: 'provisional_asset' as const,
              content: base64,
              metadata: { type: asset.type, step: asset.step, title: item.label },
              tags: ['web_buffer', asset.type],
              createdAt: new Date()
            }]
          });

          uploadedCount++;
          setIngestIngestProgress(Math.round((uploadedCount / totalAssets) * 100));
          
          // Libération mémoire agressive : on écrase la variable base64
          (base64 as any) = null; 
        }
      }

      if (ingestRes.success) {
        toast({ title: "Synchronisation réussie", description: `${qaItems.length} items et ${uploadedCount} médias transférés.` });
        setQaItems([]);
      }
    } catch (e: any) {
      toast({ title: "Erreur Critique", description: "Liaison Neon Postgres interrompue.", variant: "destructive" });
    } finally {
      setIsIngesting(false);
      setIngestIngestProgress(0);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      <input type="file" accept="image/*" capture="environment" ref={photoInputRef} onChange={handleFileChange} className="hidden" />
      <input type="file" accept="video/*" capture="environment" ref={videoInputRef} onChange={handleFileChange} className="hidden" />
      
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto terminal-scroll">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary animate-pulse" />
              <span className="font-headline font-bold text-xs lg:text-sm uppercase tracking-widest text-primary">Entraînement RAG</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-sm">
              <Smartphone className="w-3 h-3 text-primary" />
              <span className="text-[9px] font-code uppercase font-bold text-muted-foreground">NEON_INFRA_ACTIVE</span>
            </div>
          </div>
          
          <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
            <button onClick={() => setMode('qa')} className={cn("flex items-center gap-2 px-3 py-1.5 text-[9px] font-code uppercase rounded-sm", mode === 'qa' ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              Q / R
            </button>
            <button onClick={() => setMode('procedure')} className={cn("flex items-center gap-2 px-3 py-1.5 text-[9px] font-code uppercase rounded-sm", mode === 'procedure' ? "bg-secondary text-secondary-foreground" : "text-muted-foreground")}>
              Procédure
            </button>
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
          {isIngesting && (
            <Card className="p-4 border-primary/20 bg-primary/5 space-y-3 rounded-sm shadow-lg">
              <div className="flex justify-between items-center text-[10px] font-code uppercase">
                <span className="flex items-center gap-2 text-primary"><Loader2 className="w-4 h-4 animate-spin" /> Transfert atomique vers Neon...</span>
                <span className="font-bold">{ingestProgress}%</span>
              </div>
              <div className="h-1 w-full bg-primary/10 rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${ingestProgress}%` }} />
              </div>
            </Card>
          )}

          <Card className="p-4 lg:p-6 border-border bg-card/50 space-y-6 rounded-sm shadow-2xl">
            <form onSubmit={handleAddItem} className="space-y-6">
              {mode === 'qa' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase text-muted-foreground ml-1">Symptôme / Question</label>
                    <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ex: Panne pompe P-01" className="h-32 bg-background font-code text-xs uppercase" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase text-muted-foreground ml-1">Action / Réponse</label>
                    <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Ex: Vérifier alimentation..." className="h-32 bg-background font-code text-xs uppercase" />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <Input value={procTitle} onChange={(e) => setProcTitle(e.target.value)} placeholder="TITRE_DE_LA_PROCÉDURE" className="bg-background font-headline uppercase h-11" />
                  {procSteps.map((step, index) => (
                    <Card key={step.id} className="p-4 border-border bg-black/30 space-y-4">
                      <div className="flex justify-between items-center border-b border-border/50 pb-2">
                        <span className="text-[10px] font-bold font-code text-secondary">ÉTAPE {index + 1}</span>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeStep(index)} className="h-6 w-6 text-destructive"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="space-y-3">
                          <Input placeholder="ACTION_PRINCIPALE" value={step.title} onChange={(e) => updateStep(index, 'title', e.target.value)} className="h-8 text-[11px] font-code uppercase bg-background" />
                          <Textarea placeholder="DÉTAILS_TECHNIQUES" value={step.description} onChange={(e) => updateStep(index, 'description', e.target.value)} className="text-[10px] uppercase font-code bg-background min-h-[80px]" />
                        </div>
                        <div className="space-y-3">
                          <Input value={step.normalConditions} onChange={(e) => updateStep(index, 'normalConditions', e.target.value)} className="h-8 text-[9px] font-code bg-background/30" placeholder="✓ ÉTAT NORMAL" />
                          <Input value={step.abnormalConditions} onChange={(e) => updateStep(index, 'abnormalConditions', e.target.value)} className="h-8 text-[9px] font-code bg-background/30" placeholder="✗ ANOMALIE" />
                          <Input value={step.alarms} onChange={(e) => updateStep(index, 'alarms', e.target.value)} className="h-8 text-[9px] font-code bg-background/30 border-primary/30" placeholder="⚠ ALERTE" />
                        </div>
                        <div className="bg-black/20 p-3 rounded-sm border border-border/30">
                          <p className="text-[8px] font-bold uppercase text-muted-foreground mb-3">Documentation Visuelle</p>
                          <div className="flex gap-2 mb-3">
                            <Button type="button" variant="outline" size="sm" className="flex-1 h-8 text-[9px] font-code uppercase" onClick={(e) => handleTriggerCapture(e, index, 'image')} disabled={isProcessingMedia}><Camera className="w-3 h-3 mr-2" /> Photo</Button>
                            <Button type="button" variant="outline" size="sm" className="flex-1 h-8 text-[9px] font-code uppercase" onClick={(e) => handleTriggerCapture(e, index, 'video')}><Video className="w-3 h-3 mr-2" /> Vidéo</Button>
                          </div>
                          <div className="space-y-1">
                            {step.imagePreview && (
                              <div className="flex items-center justify-between p-1.5 bg-background/40 rounded-sm">
                                <button type="button" onClick={() => setPreviewMedia({ url: step.imagePreview!, type: 'image' })} className="text-[8px] font-code text-primary uppercase truncate flex items-center gap-1 hover:underline"><ImageIcon className="w-2.5 h-2.5" /> Voir_Photo <Eye className="w-2.5 h-2.5 ml-1" /></button>
                                <button type="button" onClick={() => deleteMedia(index, 'image')} className="text-destructive"><X className="w-2.5 h-2.5" /></button>
                              </div>
                            )}
                            {step.videoPreview && (
                              <div className="flex items-center justify-between p-1.5 bg-background/40 rounded-sm">
                                <button type="button" onClick={() => setPreviewMedia({ url: step.videoPreview!, type: 'video' })} className="text-[8px] font-code text-secondary uppercase truncate flex items-center gap-1 hover:underline"><Video className="w-2.5 h-2.5" /> Voir_Séquence <Eye className="w-2.5 h-2.5 ml-1" /></button>
                                <button type="button" onClick={() => deleteMedia(index, 'video')} className="text-destructive"><X className="w-2.5 h-2.5" /></button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                  <Button type="button" variant="outline" onClick={addStep} className="w-full border-dashed h-9 text-[10px] uppercase font-code"><Plus className="w-3.5 h-3.5 mr-2" /> Ajouter une Étape</Button>
                </div>
              )}
              <div className="flex justify-end pt-4">
                <Button type="submit" size="sm" className={cn("font-headline font-bold uppercase text-[10px] h-9 px-8", mode === 'qa' ? "bg-primary" : "bg-secondary")}>Ajouter à la file d'attente</Button>
              </div>
            </form>
          </Card>

          <div className="space-y-4 pb-12">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> File d'attente ({qaItems.length})</h3>
              {qaItems.length > 0 && (
                <Button onClick={handleFinalSubmit} disabled={isIngesting} className="bg-primary text-[10px] uppercase font-bold h-9 px-6 animate-pulse">
                  {isIngesting ? <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5 mr-2" />} Synchroniser vers le Moteur
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3">
              {qaItems.map((item) => (
                <Card key={item.id} className="p-4 border-border bg-black/20 font-code text-[10px] flex justify-between items-center rounded-sm">
                  <div className="flex items-center gap-4 truncate">
                    <div className={cn("h-8 w-8 rounded-sm flex items-center justify-center border", item.type === 'procedure' ? "border-secondary/30" : "border-primary/30")}>
                      {item.type === 'procedure' ? <ListOrdered className="w-4 h-4 text-secondary" /> : <MessageSquare className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="truncate">
                      <span className={cn("font-bold mr-2 uppercase", item.type === 'procedure' ? "text-secondary" : "text-primary")}>{item.type === 'procedure' ? 'PROCÉDURE' : 'Q/R'}:</span> 
                      <span className="text-muted-foreground uppercase">{item.label}</span>
                      {item.mediaAssets && item.mediaAssets.length > 0 && <Badge variant="outline" className="ml-3 text-[7px] border-yellow-500/50 text-yellow-500">{item.mediaAssets.length} MÉDIAS_NEON</Badge>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setQaItems(prev => prev.filter(i => i.id !== item.id))} className="h-8 w-8"><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Dialog open={!!previewMedia} onOpenChange={() => setPreviewMedia(null)}>
        <DialogContent className="max-w-3xl bg-card border-primary/30 text-foreground sm:rounded-sm">
          <DialogHeader className="border-b border-border pb-2">
            <DialogTitle className="text-xs uppercase font-headline tracking-widest flex items-center gap-2"><Eye className="w-4 h-4 text-primary" /> Visualisation_Asset_Neon</DialogTitle>
          </DialogHeader>
          <div className="mt-4 relative aspect-video bg-black/40 rounded-sm overflow-hidden flex items-center justify-center border border-border shadow-inner">
            {previewMedia?.type === 'image' ? <img src={previewMedia.url} alt="Capture réelle" className="max-w-full max-h-full object-contain" /> : <video src={previewMedia?.url} controls autoPlay className="max-w-full max-h-full" />}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.05)_50%)] z-10 bg-[length:100%_4px]" />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setPreviewMedia(null)} className="h-8 text-[10px] font-code uppercase">Fermer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
