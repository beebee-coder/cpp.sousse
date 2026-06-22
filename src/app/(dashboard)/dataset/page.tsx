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
  Globe,
  ListOrdered,
  MessageSquare,
  AlertTriangle,
  Check,
  Image as ImageIcon,
  Video,
  Layers,
  ArrowRight,
  Camera,
  Lock,
  Eye,
  RefreshCw,
  Loader2
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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

interface Procedure {
  id: string;
  title: string;
  steps: ProcedureStep[];
}

interface QAItem {
  id: string;
  question: string;
  answer: string;
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
  const [lastResult, setLastResult] = useState<{ provider: string, count: number } | null>(null);

  // État pour la capture multimédia
  const [capturingForStep, setCapturingForStep] = useState<{ index: number, type: 'image' | 'video' } | null>(null);

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

  // Simule une capture multimédia (Provisoire sur Web, Réelle sur Natif)
  const handleCapture = (index: number, type: 'image' | 'video') => {
    const timestamp = Date.now();
    const mockDataUri = type === 'image' 
      ? `data:image/jpeg;base64,CAPTURED_IMG_${timestamp}`
      : `data:video/mp4;base64,CAPTURED_VID_${timestamp}`;

    const newSteps = [...procSteps];
    if (type === 'image') {
      newSteps[index].imageUrl = mockDataUri;
    } else {
      newSteps[index].videoUrl = mockDataUri;
    }
    newSteps[index].isProvisional = !isDesktop;
    setProcSteps(newSteps);

    toast({
      title: isDesktop ? "Asset Local lié" : "Asset Provisoire capturé",
      description: `Le support ${type} sera synchronisé avec le moteur de vision.`,
    });
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'qa') {
      if (!question.trim() || !answer.trim()) return;
      setQaItems(prev => [{ id: Date.now().toString(), question, answer }, ...prev]);
      setQuestion('');
      setAnswer('');
    } else {
      if (!procTitle.trim() || procSteps.some(s => !s.title.trim())) {
        toast({ title: "Champs requis", description: "Veuillez nommer la procédure et toutes ses étapes.", variant: "destructive" });
        return;
      }
      
      const serializedProcedure = `PROCÉDURE TECHNIQUE : ${procTitle}\n\n` + 
        procSteps.map((s, i) => (
          `Étape ${i + 1}: ${s.title}\n` +
          `Détail: ${s.description}\n` +
          (s.normalConditions ? `Conditions Normales: ${s.normalConditions}\n` : '') +
          (s.abnormalConditions ? `Conditions Anormales: ${s.abnormalConditions}\n` : '') +
          (s.alarms ? `⚠ ALERTES: ${s.alarms}\n` : '') +
          (s.imageUrl ? `[MEDIA_IMAGE]: ${s.imageUrl}\n` : '') +
          (s.videoUrl ? `[MEDIA_VIDEO]: ${s.videoUrl}\n` : '')
        )).join('\n---\n');

      // On prépare les assets à envoyer en provisional si on est sur Web
      const provisionalAssets = procSteps.flatMap((s, idx) => {
        const assets = [];
        if (s.imageUrl?.startsWith('data:') && !isDesktop) assets.push({ type: 'image', content: s.imageUrl, step: idx });
        if (s.videoUrl?.startsWith('data:') && !isDesktop) assets.push({ type: 'video', content: s.videoUrl, step: idx });
        return assets;
      });

      setQaItems(prev => [{ 
        id: Date.now().toString(), 
        question: `PROCÉDURE : ${procTitle}`, 
        answer: serializedProcedure,
        mediaAssets: provisionalAssets
      }, ...prev]);
      
      setProcTitle('');
      setProcSteps([{ id: '1', title: '', description: '', subSteps: [], normalConditions: '', abnormalConditions: '', alarms: '', imageUrl: '', videoUrl: '' }]);
      setMode('qa');
      toast({ title: "Ajouté", description: "La procédure a été ajoutée à la file d'attente." });
    }
  };

  const handleFinalSubmit = async () => {
    if (qaItems.length === 0) return;
    setIsIngesting(true);

    try {
      // 1. Envoyer les textes au RAG (Weaviate ou Chroma)
      const res = await apiClient.post<{ success: boolean; message: string; provider: string }>('/api/vector/ingest', {
        filename: `dataset-${Date.now()}.jsonl`,
        items: qaItems.map(i => ({ question: i.question, answer: i.answer })),
        metadata: { collection: 'industrial_manuals', source: 'UI_UPLOAD' }
      });

      // 2. Si assets provisoires (Mode Web), les envoyer au Buffer Cloud
      const itemsWithAssets = qaItems.filter(i => i.mediaAssets && i.mediaAssets.length > 0);
      if (itemsWithAssets.length > 0 && !isDesktop) {
        const assetsPayload = itemsWithAssets.flatMap(i => i.mediaAssets!.map(a => ({
          id: `provisional-${Date.now()}-${Math.random()}`,
          projectId: 'project-001',
          type: 'provisional_asset' as const,
          content: a.content,
          metadata: { type: a.type, parentId: i.id, step: a.step },
          tags: ['capture_web', a.type],
          createdAt: new Date()
        })));

        await apiClient.post('/api/sync/upload', { userId: 'admin', projectId: 'project-001', items: assetsPayload });
        toast({ title: "Assets Provisoires", description: "Média uploadés sur le Cloud. Prêts pour sync locale." });
      }

      if (res.success) {
        toast({
          title: "Succès du RAG",
          description: `${qaItems.length} éléments indexés via ${res.provider}.`,
        });
        setLastResult({ provider: res.provider || 'Inconnu', count: qaItems.length });
        setQaItems([]);
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto terminal-scroll">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary animate-pulse" />
              <span className="font-headline font-bold text-xs lg:text-sm uppercase tracking-widest text-primary">RAG Hybride</span>
            </div>
            <div className="hidden sm:block h-4 w-px bg-border mx-2" />
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-sm">
              {isDesktop ? <Cpu className="w-3 h-3 text-secondary" /> : <Globe className="w-3 h-3 text-primary" />}
              <span className="text-[9px] font-code uppercase font-bold text-muted-foreground whitespace-nowrap">
                {isDesktop ? "STATION LOCALE (CHROMA)" : "ENTRAÎNEMENT CLOUD (WEAVIATE)"}
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
          {lastResult && (
            <Card className="p-4 border-secondary/30 bg-secondary/5 flex items-center gap-3 rounded-sm animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
              <div className="font-code text-[10px] lg:text-xs">
                <p className="font-bold uppercase text-secondary">Indexation Réussie</p>
                <p className="text-muted-foreground">{lastResult.count} éléments via <span className="text-primary font-bold">{lastResult.provider}</span></p>
                {!isDesktop && <p className="text-[8px] text-primary/70 mt-1 italic">* Assets multimédias en attente de purge locale.</p>}
              </div>
            </Card>
          )}

          <Card className="p-4 lg:p-6 border-border bg-card/50 shadow-xl space-y-6 rounded-sm">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-[10px] lg:text-xs font-bold uppercase tracking-widest font-headline text-muted-foreground flex items-center gap-2">
                <Plus className={cn("w-4 h-4", mode === 'qa' ? "text-primary" : "text-secondary")} />
                {mode === 'qa' ? "Ajouter une Connaissance" : "Définir une Procédure Industrielle"}
              </h3>
              <Badge variant="outline" className="font-code text-[8px] uppercase">
                {mode === 'qa' ? "Format Atomique" : "Format Séquentiel"}
              </Badge>
            </div>
            
            <form onSubmit={handleAddItem} className="space-y-6">
              {mode === 'qa' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase text-muted-foreground ml-1">Question / Symptôme</label>
                    <Textarea
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Ex: Que faire si la pression monte à 5 bars ?"
                      className="w-full h-32 bg-background/50 border-border rounded-sm p-3 font-code text-xs uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase text-muted-foreground ml-1">Réponse / Action</label>
                    <Textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Ex: Couper la vanne d'arrivée et vérifier le purgeur..."
                      className="w-full h-32 bg-background/50 border-border rounded-sm p-3 font-code text-xs uppercase"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase text-muted-foreground ml-1">Nom de la Procédure</label>
                    <Input 
                      value={procTitle}
                      onChange={(e) => setProcTitle(e.target.value)}
                      placeholder="NOM_MAINTENANCE_POMPE_P12"
                      className="bg-background/50 border-border font-headline uppercase text-sm h-11"
                    />
                  </div>

                  <div className="space-y-4">
                    {procSteps.map((step, index) => (
                      <Card key={index} className="p-4 border-border bg-black/30 space-y-4 relative group">
                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold font-code text-secondary">ÉTAPE {index + 1}</span>
                            {(step.imageUrl || step.videoUrl) && (
                              <div className="flex gap-1">
                                {step.imageUrl && <ImageIcon className={cn("w-3 h-3", step.isProvisional ? "text-yellow-500" : "text-primary/50")} />}
                                {step.videoUrl && <Video className={cn("w-3 h-3", step.isProvisional ? "text-yellow-500" : "text-secondary/50")} />}
                              </div>
                            )}
                          </div>
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
                            <div>
                              <label className="text-[8px] font-bold uppercase text-muted-foreground block mb-1">Titre de l'action</label>
                              <Input 
                                placeholder="TITRE_ACTION"
                                value={step.title}
                                onChange={(e) => updateStep(index, 'title', e.target.value)}
                                className="h-8 text-[11px] font-code uppercase bg-background"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold uppercase text-muted-foreground block mb-1">Description détaillée</label>
                              <Textarea 
                                placeholder="DESCRIPTION_DÉTAILLÉE"
                                value={step.description}
                                onChange={(e) => updateStep(index, 'description', e.target.value)}
                                className="text-[10px] uppercase font-code bg-background min-h-[100px]"
                              />
                            </div>
                          </div>

                          <div className="space-y-3 lg:col-span-1">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[8px] font-bold text-secondary uppercase flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5" /> Normal
                                </label>
                                <Input 
                                  value={step.normalConditions}
                                  onChange={(e) => updateStep(index, 'normalConditions', e.target.value)}
                                  className="h-7 text-[9px] font-code bg-background/30"
                                  placeholder="Statut OK"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] font-bold text-destructive uppercase flex items-center gap-1">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Anormal
                                </label>
                                <Input 
                                  value={step.abnormalConditions}
                                  onChange={(e) => updateStep(index, 'abnormalConditions', e.target.value)}
                                  className="h-7 text-[9px] font-code bg-background/30"
                                  placeholder="Anomalie"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] font-bold text-primary uppercase flex items-center gap-1">
                                <Layers className="w-2.5 h-2.5" /> Alarme / Action Immédiate
                              </label>
                              <Input 
                                value={step.alarms}
                                onChange={(e) => updateStep(index, 'alarms', e.target.value)}
                                className="h-7 text-[9px] font-code bg-background/30"
                                placeholder="Déclencher purge..."
                              />
                            </div>
                          </div>

                          <div className="space-y-3 lg:col-span-1 bg-black/20 p-3 rounded-sm border border-border/30 relative overflow-hidden min-h-[180px]">
                            <label className="text-[8px] font-bold uppercase text-muted-foreground block mb-2 border-b border-border/50 pb-1">Capture & Documentation</label>
                            
                            <div className="space-y-3">
                              {/* BOUTONS DE CAPTURE (PROVISOIRE WEB / RÉEL LOCAL) */}
                              <div className="flex gap-2 mb-4">
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm" 
                                  className="flex-1 h-8 text-[9px] font-code uppercase border-primary/40 text-primary"
                                  onClick={() => handleCapture(index, 'image')}
                                >
                                  <Camera className="w-3 h-3 mr-2" />
                                  Capture Photo
                                </Button>
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm" 
                                  className="flex-1 h-8 text-[9px] font-code uppercase border-secondary/40 text-secondary"
                                  onClick={() => handleCapture(index, 'video')}
                                >
                                  <Video className="w-3 h-3 mr-2" />
                                  Capture Vidéo
                                </Button>
                              </div>

                              <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-code uppercase text-primary flex items-center gap-1.5">
                                    <ImageIcon className="w-3 h-3" /> {isDesktop ? "Chemin Asset" : "Asset Provisoire"}
                                  </span>
                                  {step.imageUrl && <Badge variant="outline" className={cn("text-[7px] h-4 uppercase border-primary text-primary", step.isProvisional && "border-yellow-500 text-yellow-500")}>{step.isProvisional ? 'WEB_BUFFER' : 'LIÉ'}</Badge>}
                                </div>
                                <Input 
                                  placeholder={isDesktop ? "URL_OU_PATH_CHROMA" : "Capture requise"}
                                  value={step.imageUrl}
                                  onChange={(e) => updateStep(index, 'imageUrl', e.target.value)}
                                  className="h-7 text-[9px] font-code bg-background/20"
                                />
                              </div>

                              <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-code uppercase text-secondary flex items-center gap-1.5">
                                    <Video className="w-3 h-3" /> {isDesktop ? "Chemin Vidéo" : "Buffer Vidéo"}
                                  </span>
                                  {step.videoUrl && <Badge variant="outline" className={cn("text-[7px] h-4 uppercase border-secondary text-secondary", step.isProvisional && "border-yellow-500 text-yellow-500")}>{step.isProvisional ? 'WEB_BUFFER' : 'LIÉ'}</Badge>}
                                </div>
                                <Input 
                                  placeholder={isDesktop ? "URL_OU_PATH_CHROMA" : "Capture requise"}
                                  value={step.videoUrl}
                                  onChange={(e) => updateStep(index, 'videoUrl', e.target.value)}
                                  className="h-7 text-[9px] font-code bg-background/20"
                                />
                              </div>
                              
                              <p className="text-[7px] text-muted-foreground italic mt-1 text-center uppercase">
                                {isDesktop ? "Liaison directe aux banques d'actifs locale." : "Assets stockés provisoirement (Nettoyage post-sync)."}
                              </p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                    
                    <button 
                      type="button" 
                      onClick={addStep}
                      className="w-full border border-dashed border-secondary/30 text-secondary hover:bg-secondary/5 h-9 text-[10px] uppercase font-code rounded-sm transition-colors flex items-center justify-center"
                    >
                      <Plus className="w-3.5 h-3.5 mr-2" />
                      Ajouter une Étape de Procédure
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button type="submit" size="sm" className={cn(
                  "font-headline font-bold uppercase text-[10px] h-9 px-8 shadow-lg",
                  mode === 'qa' ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                )}>
                  Ajouter à la file d'attente d'entraînement
                </Button>
              </div>
            </form>
          </Card>

          <div className="space-y-4 pb-12">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-[10px] lg:text-xs font-bold uppercase tracking-widest font-headline text-muted-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Éléments prêts pour l'indexation ({qaItems.length})
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
                <p className="font-code text-[9px] lg:text-[10px] uppercase tracking-[0.2em]">La file d'attente est vide.</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              {qaItems.map((item) => (
                <Card key={item.id} className="p-4 border-border bg-black/20 font-code text-[10px] flex justify-between items-center group rounded-sm hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={cn(
                      "h-8 w-8 rounded-sm flex items-center justify-center shrink-0 border",
                      item.question.startsWith('PROCÉDURE') ? "bg-secondary/10 border-secondary/20" : "bg-primary/10 border-primary/20"
                    )}>
                      {item.question.startsWith('PROCÉDURE') ? <ListOrdered className="w-4 h-4 text-secondary" /> : <MessageSquare className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="truncate">
                      <span className={cn("font-bold mr-2", item.question.startsWith('PROCÉDURE') ? "text-secondary" : "text-primary")}>
                        {item.question.split(':')[0]}:
                      </span> 
                      <span className="text-muted-foreground">{item.question.split(':').slice(1).join(':')}</span>
                      {item.mediaAssets && item.mediaAssets.length > 0 && (
                        <Badge variant="outline" className="ml-3 text-[7px] border-yellow-500/50 text-yellow-500 bg-yellow-500/5">
                          {item.mediaAssets.length} ASSETS PROVISOIRES
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
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
    </div>
  );
}
