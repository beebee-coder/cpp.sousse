"use client";

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Database, 
  Plus, 
  Trash2, 
  FileJson, 
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
  Info,
  X,
  Check,
  Loader2
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
import Image from 'next/image';

interface ProcedureStep {
  id: string;
  title: string;
  description: string;
  subSteps: string[];
  normalConditions: string;
  abnormalConditions: string;
  alarms: string;
  imageUrl?: string;
  videoUrl?: string;
  isProvisional?: boolean;
}

interface QAItem {
  id: string;
  type: 'qa' | 'procedure';
  label: string;
  details: string;
  mediaAssets?: any[];
}

export default function DatasetPage() {
  const { toast } = useToast();
  const { isDesktop } = usePlatform();
  
  const [mode, setMode] = useState<'qa' | 'procedure'>('qa');
  const [qaItems, setQaItems] = useState<QAItem[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const [procTitle, setProcTitle] = useState('');
  const [procSteps, setProcSteps] = useState<ProcedureStep[]>([
    { id: '1', title: '', description: '', subSteps: [], normalConditions: '', abnormalConditions: '', alarms: '', imageUrl: '', videoUrl: '' }
  ]);

  const [isIngesting, setIsIngesting] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [lastResult, setLastResult] = useState<{ provider: string, count: number } | null>(null);
  
  const [previewMedia, setPreviewMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const activeCaptureRef = useRef<{ index: number, type: 'image' | 'video' } | null>(null);

  const compressImage = (dataUri: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        // Compression en JPEG 0.7 pour passer sous la limite Vercel de 4.5MB
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = dataUri;
    });
  };

  const addStep = () => {
    setProcSteps([...procSteps, { 
      id: (procSteps.length + 1).toString(), 
      title: '', 
      description: '', 
      subSteps: [], 
      normalConditions: '', 
      abnormalConditions: '', 
      alarms: '',
      imageUrl: '',
      videoUrl: ''
    }]);
  };

  const removeStep = (index: number) => {
    if (procSteps.length <= 1) return;
    const newSteps = [...procSteps];
    newSteps.splice(index, 1);
    setProcSteps(newSteps);
  };

  const updateStep = (index: number, field: keyof ProcedureStep, value: string) => {
    const newSteps = [...procSteps];
    (newSteps[index] as any)[field] = value;
    setProcSteps(newSteps);
  };

  const deleteMedia = (index: number, type: 'image' | 'video') => {
    const newSteps = [...procSteps];
    if (type === 'image') newSteps[index].imageUrl = '';
    else newSteps[index].videoUrl = '';
    setProcSteps(newSteps);
  };

  const handleTriggerCapture = (e: React.MouseEvent, index: number, type: 'image' | 'video') => {
    e.preventDefault();
    e.stopPropagation();
    activeCaptureRef.current = { index, type };
    if (type === 'image') {
      photoInputRef.current?.click();
    } else {
      videoInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCaptureRef.current) return;

    const { index, type } = activeCaptureRef.current;
    
    if (type === 'image') setIsProcessingImage(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      let finalDataUri = reader.result as string;
      
      if (type === 'image') {
        try {
          finalDataUri = await compressImage(finalDataUri);
        } catch (err) {
          console.error("Échec compression image:", err);
        } finally {
          setIsProcessingImage(false);
        }
      }

      const newSteps = [...procSteps];
      if (type === 'image') {
        newSteps[index].imageUrl = finalDataUri;
      } else {
        newSteps[index].videoUrl = finalDataUri;
      }
      newSteps[index].isProvisional = true;
      setProcSteps(newSteps);
      
      toast({
        title: type === 'image' ? "Photo capturée" : "Vidéo capturée",
        description: "Optimisation terminée. Prévisualisation disponible.",
      });
      
      e.target.value = '';
    };

    reader.readAsDataURL(file);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'qa') {
      if (!question.trim() || !answer.trim()) {
        toast({ title: "Champs requis", description: "Remplissez la question et la réponse.", variant: "destructive" });
        return;
      }
      setQaItems(prev => [{ id: Date.now().toString(), type: 'qa', label: question, details: answer }, ...prev]);
      setQuestion(''); setAnswer('');
    } else {
      if (!procTitle.trim() || procSteps.some(s => !s.title.trim())) {
        toast({ title: "Champs requis", description: "Nommez la procédure et ses étapes.", variant: "destructive" });
        return;
      }
      
      const serializedProcedure = `PROCÉDURE: ${procTitle}\n\n` + 
        procSteps.map((s, i) => (
          `[E${i + 1}] ${s.title}: ${s.description}\n` +
          (s.normalConditions ? `OK: ${s.normalConditions} | ` : '') +
          (s.abnormalConditions ? `KO: ${s.abnormalConditions} | ` : '') +
          (s.alarms ? `ALERTE: ${s.alarms}` : '')
        )).join('\n---\n');

      const provisionalAssets = procSteps.flatMap((s, idx) => {
        const assets = [];
        if (s.imageUrl) assets.push({ type: 'image', content: s.imageUrl, step: idx });
        if (s.videoUrl) assets.push({ type: 'video', content: s.videoUrl, step: idx });
        return assets;
      });

      setQaItems(prev => [{ 
        id: Date.now().toString(), 
        type: 'procedure',
        label: procTitle, 
        details: serializedProcedure,
        mediaAssets: provisionalAssets
      }, ...prev]);
      
      setProcTitle('');
      setProcSteps([{ id: '1', title: '', description: '', subSteps: [], normalConditions: '', abnormalConditions: '', alarms: '', imageUrl: '', videoUrl: '' }]);
    }
    toast({ title: "Élément ajouté", description: "Prêt pour l'indexation globale." });
  };

  const handleFinalSubmit = async () => {
    if (qaItems.length === 0) return;
    setIsIngesting(true);

    try {
      const res = await apiClient.post<{ success: boolean; message: string; provider: string }>('/api/vector/ingest', {
        items: qaItems.map(i => ({ 
          question: i.type === 'procedure' ? `PROCÉDURE: ${i.label}` : i.label, 
          answer: i.details 
        })),
        metadata: { collection: 'industrial_manuals', source: isDesktop ? 'STATION_FORGE' : 'CAPTURE_TERRAIN' }
      });

      const itemsWithAssets = qaItems.filter(i => i.mediaAssets && i.mediaAssets.length > 0);
      if (itemsWithAssets.length > 0) {
        const assetsPayload = itemsWithAssets.flatMap(i => i.mediaAssets!.map(a => ({
          id: `provisional-${Date.now()}-${Math.random()}`,
          projectId: 'project-001',
          type: 'provisional_asset' as const,
          content: a.content,
          metadata: { type: a.type, parentId: i.id, step: a.step, title: i.label },
          tags: ['web_buffer_capture', a.type],
          createdAt: new Date()
        })));

        await apiClient.post('/api/sync/upload', { userId: 'admin', projectId: 'project-001', items: assetsPayload });
      }

      if (res.success) {
        toast({ title: "Indexation réussie", description: `${qaItems.length} éléments via ${res.provider}.` });
        setLastResult({ provider: res.provider || 'Inconnu', count: qaItems.length });
        setQaItems([]);
      }
    } catch (e: any) {
      toast({ title: "Échec de transmission", description: e.message, variant: "destructive" });
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        ref={photoInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />
      <input 
        type="file" 
        accept="video/*" 
        capture="environment" 
        ref={videoInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />
      
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto terminal-scroll">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary animate-pulse" />
              <span className="font-headline font-bold text-xs lg:text-sm uppercase tracking-widest text-primary">Entraînement RAG</span>
            </div>
            <div className="hidden sm:block h-4 w-px bg-border mx-2" />
            <div className="flex items-center gap-2 px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-sm">
              {!isDesktop ? <Smartphone className="w-3 h-3 text-primary" /> : <Cpu className="w-3 h-3 text-secondary" />}
              <span className="text-[9px] font-code uppercase font-bold text-muted-foreground whitespace-nowrap">
                {!isDesktop ? "MODE TERRAIN (WEB_BUFFER)" : "STATION FORGE (LOCAL_CHROMA)"}
              </span>
            </div>
          </div>
          
          <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
            <button 
              onClick={() => setMode('qa')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-[9px] font-code uppercase rounded-sm transition-all",
                mode === 'qa' ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              <MessageSquare className="w-3 h-3" />
              Q / R
            </button>
            <button 
              onClick={() => setMode('procedure')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-[9px] font-code uppercase rounded-sm transition-all",
                mode === 'procedure' ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"
              )}
            >
              <ListOrdered className="w-3 h-3" />
              Procédure
            </button>
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
          {isProcessingImage && (
            <Card className="p-3 border-primary/20 bg-primary/5 flex items-center gap-3 rounded-sm animate-pulse">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <p className="text-[9px] font-code uppercase text-primary leading-tight">
                Optimisation du flux visuel en cours (Compression industrielle)...
              </p>
            </Card>
          )}

          {lastResult && (
            <Card className="p-4 border-secondary/30 bg-secondary/5 flex items-center gap-3 rounded-sm">
              <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
              <div className="font-code text-[10px] lg:text-xs">
                <p className="font-bold uppercase text-secondary">Transmission Terminée</p>
                <p className="text-muted-foreground">{lastResult.count} éléments injectés via <span className="text-primary font-bold">{lastResult.provider}</span></p>
              </div>
            </Card>
          )}

          <Card className="p-4 lg:p-6 border-border bg-card/50 shadow-xl space-y-6 rounded-sm">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-[10px] lg:text-xs font-bold uppercase tracking-widest font-headline text-muted-foreground flex items-center gap-2">
                <Plus className={cn("w-4 h-4", mode === 'qa' ? "text-primary" : "text-secondary")} />
                {mode === 'qa' ? "Ajouter une Connaissance" : "Élaborer une Procédure Industrielle"}
              </h3>
            </div>
            
            <form onSubmit={handleAddItem} className="space-y-6">
              {mode === 'qa' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase text-muted-foreground ml-1">Question / Symptôme</label>
                    <Textarea
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Ex: Vibration anormale moteur P-02"
                      className="w-full h-32 bg-background/50 border-border rounded-sm p-3 font-code text-xs uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase text-muted-foreground ml-1">Réponse / Action</label>
                    <Textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Ex: Vérifier l'alignement de l'arbre et graisser les paliers."
                      className="w-full h-32 bg-background/50 border-border rounded-sm p-3 font-code text-xs uppercase"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase text-muted-foreground ml-1">Titre de la Procédure</label>
                    <Input 
                      value={procTitle}
                      onChange={(e) => setProcTitle(e.target.value)}
                      placeholder="MAINTENANCE_PRÉVENTIVE_SÉRIE_X"
                      className="bg-background/50 border-border font-headline uppercase text-sm h-11"
                    />
                  </div>

                  <div className="space-y-4">
                    {procSteps.map((step, index) => (
                      <Card key={index} className="p-4 border-border bg-black/30 space-y-4 relative group">
                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                          <span className="text-[10px] font-bold font-code text-secondary">ÉTAPE {index + 1}</span>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeStep(index)}
                            className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          <div className="space-y-3 lg:col-span-1">
                            <Input 
                              placeholder="ACTION_PRINCIPALE"
                              value={step.title}
                              onChange={(e) => updateStep(index, 'title', e.target.value)}
                              className="h-8 text-[11px] font-code uppercase bg-background"
                            />
                            <Textarea 
                              placeholder="DÉTAILS_TECHNIQUES"
                              value={step.description}
                              onChange={(e) => updateStep(index, 'description', e.target.value)}
                              className="text-[10px] uppercase font-code bg-background min-h-[80px]"
                            />
                          </div>

                          <div className="space-y-3 lg:col-span-1">
                            <Input 
                              value={step.normalConditions}
                              onChange={(e) => updateStep(index, 'normalConditions', e.target.value)}
                              className="h-8 text-[9px] font-code bg-background/30"
                              placeholder="✓ ÉTAT NORMAL"
                            />
                            <Input 
                              value={step.abnormalConditions}
                              onChange={(e) => updateStep(index, 'abnormalConditions', e.target.value)}
                              className="h-8 text-[9px] font-code bg-background/30"
                              placeholder="✗ ANOMALIE"
                            />
                            <Input 
                              value={step.alarms}
                              onChange={(e) => updateStep(index, 'alarms', e.target.value)}
                              className="h-8 text-[9px] font-code bg-background/30 border-primary/30"
                              placeholder="⚠ ALERTE"
                            />
                          </div>

                          <div className="space-y-3 lg:col-span-1 bg-black/20 p-3 rounded-sm border border-border/30">
                            <label className="text-[8px] font-bold uppercase text-muted-foreground block mb-2 border-b border-border/50 pb-1">Documentation Visuelle</label>
                            
                            <div className="flex gap-2 mb-3">
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                className="flex-1 h-8 text-[9px] font-code uppercase border-primary/40 text-primary"
                                onClick={(e) => handleTriggerCapture(e, index, 'image')}
                                disabled={isProcessingImage}
                              >
                                {isProcessingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3 mr-2" />}
                                {step.imageUrl ? "Changer" : "Photo"}
                              </Button>
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                className="flex-1 h-8 text-[9px] font-code uppercase border-secondary/40 text-secondary"
                                onClick={(e) => handleTriggerCapture(e, index, 'video')}
                              >
                                <Video className="w-3 h-3 mr-2" />
                                {step.videoUrl ? "Changer" : "Vidéo"}
                              </Button>
                            </div>

                            <div className="space-y-1">
                              {step.imageUrl && (
                                <div className="flex items-center justify-between p-1.5 bg-background/40 rounded-sm">
                                  <button 
                                    type="button"
                                    onClick={() => setPreviewMedia({ url: step.imageUrl!, type: 'image' })}
                                    className="text-[8px] font-code text-primary uppercase truncate flex items-center gap-1 hover:underline group"
                                  >
                                    <ImageIcon className="w-2.5 h-2.5 shrink-0" /> 
                                    <span className="truncate">Visualiser_Asset</span>
                                    <Eye className="w-2.5 h-2.5 ml-1 opacity-50 group-hover:opacity-100" />
                                  </button>
                                  <button type="button" onClick={() => deleteMedia(index, 'image')} className="text-destructive p-1 hover:bg-destructive/10 rounded">
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              )}
                              {step.videoUrl && (
                                <div className="flex items-center justify-between p-1.5 bg-background/40 rounded-sm">
                                  <button 
                                    type="button"
                                    onClick={() => setPreviewMedia({ url: step.videoUrl!, type: 'video' })}
                                    className="text-[8px] font-code text-secondary uppercase truncate flex items-center gap-1 hover:underline group"
                                  >
                                    <Video className="w-2.5 h-2.5 shrink-0" /> 
                                    <span className="truncate">Visualiser_Séquence</span>
                                    <Eye className="w-2.5 h-2.5 ml-1 opacity-50 group-hover:opacity-100" />
                                  </button>
                                  <button type="button" onClick={() => deleteMedia(index, 'video')} className="text-destructive p-1 hover:bg-destructive/10 rounded">
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              )}
                              {!step.imageUrl && !step.videoUrl && (
                                <div className="p-4 border border-dashed border-border/50 rounded-sm bg-black/10 flex flex-col items-center justify-center opacity-40">
                                   <ImageIcon className="w-4 h-4 mb-1" />
                                   <p className="text-[7px] font-code uppercase text-center">Aucun média</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                    
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={addStep}
                      className="w-full border-dashed border-muted-foreground/30 text-muted-foreground hover:text-primary h-9 text-[10px] uppercase font-code"
                    >
                      <Plus className="w-3.5 h-3.5 mr-2" />
                      Ajouter une Étape
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button type="submit" size="sm" className={cn(
                  "font-headline font-bold uppercase text-[10px] h-9 px-8 shadow-lg",
                  mode === 'qa' ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                )}>
                  Ajouter à la file d'attente
                </Button>
              </div>
            </form>
          </Card>

          <div className="space-y-4 pb-12">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-[10px] lg:text-xs font-bold uppercase tracking-widest font-headline text-muted-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Items en attente ({qaItems.length})
              </h3>
              {qaItems.length > 0 && (
                <Button onClick={handleFinalSubmit} disabled={isIngesting} className="bg-primary text-primary-foreground font-headline font-bold uppercase text-[10px] h-9 px-6 animate-pulse">
                  {isIngesting ? <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5 mr-2" />}
                  {isIngesting ? "Transmission..." : "Synchroniser vers le Moteur"}
                </Button>
              )}
            </div>

            {qaItems.length === 0 && !lastResult && (
              <div className="p-16 border border-dashed border-border rounded-sm bg-black/10 text-center opacity-30">
                <FileJson className="w-10 h-10 mx-auto mb-4" />
                <p className="font-code text-[9px] lg:text-[10px] uppercase tracking-[0.2em]">File d'attente vide.</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              {qaItems.map((item) => (
                <Card key={item.id} className="p-4 border-border bg-black/20 font-code text-[10px] flex justify-between items-center group rounded-sm hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={cn(
                      "h-8 w-8 rounded-sm flex items-center justify-center shrink-0 border",
                      item.type === 'procedure' ? "bg-secondary/10 border-secondary/20" : "bg-primary/10 border-primary/20"
                    )}>
                      {item.type === 'procedure' ? <ListOrdered className="w-4 h-4 text-secondary" /> : <MessageSquare className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="truncate">
                      <span className={cn("font-bold mr-2 uppercase", item.type === 'procedure' ? "text-secondary" : "text-primary")}>
                        {item.type === 'procedure' ? 'PROCÉDURE' : 'Q/R'}:
                      </span> 
                      <span className="text-muted-foreground uppercase">{item.label}</span>
                      {item.mediaAssets && item.mediaAssets.length > 0 && (
                        <Badge variant="outline" className="ml-3 text-[7px] border-yellow-500/50 text-yellow-500 bg-yellow-500/5">
                          {item.mediaAssets.length} MÉDIAS (WEB_BUFFER)
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <Badge variant="outline" className="text-[7px] uppercase border-green-500 text-green-500 bg-green-500/5">
                       Prêt
                     </Badge>
                    <Button variant="ghost" size="icon" onClick={() => setQaItems(prev => prev.filter(i => i.id !== item.id))} className="h-8 w-8 hover:bg-destructive/10">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Dialog open={!!previewMedia} onOpenChange={() => setPreviewMedia(null)}>
        <DialogContent className="max-w-3xl bg-card border-primary/30 text-foreground sm:rounded-sm">
          <DialogHeader className="border-b border-border pb-2">
            <DialogTitle className="text-xs uppercase font-headline tracking-widest flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              Vérification Opérateur
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4 relative aspect-video bg-black/40 rounded-sm overflow-hidden flex items-center justify-center border border-border shadow-inner">
            {previewMedia?.type === 'image' ? (
              <img 
                src={previewMedia.url} 
                alt="Capture réelle" 
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <video 
                src={previewMedia?.url} 
                controls 
                autoPlay 
                className="max-w-full max-h-full"
              />
            )}
            
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.05)_50%)] z-10 bg-[length:100%_4px]" />
          </div>

          <div className="mt-4 flex justify-between items-center">
            <p className="text-[9px] font-code text-muted-foreground uppercase">
              STATUS: VÉRIFICATION_BUFFER | TYPE: {previewMedia?.type}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPreviewMedia(null)} className="h-8 text-[10px] font-code uppercase border-border">
                Fermer
              </Button>
              <Button size="sm" onClick={() => setPreviewMedia(null)} className="h-8 text-[10px] font-code uppercase bg-primary text-primary-foreground">
                <Check className="w-3 h-3 mr-2" />
                Confirmer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
