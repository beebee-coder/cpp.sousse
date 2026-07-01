"use client";

import { useState, useEffect, useCallback } from 'react';
import { 
  Database, Plus, Loader2, Trash2, 
  Zap, Layers, ShieldAlert,
  Info, Camera, Video, AlertTriangle, Activity,
  ListChecks, ShieldCheck, MessageSquare, BookOpen,
  Save, Mic, MicOff
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { useVoice } from '@/hooks/use-voice';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { ProcedureStep } from '@/lib/procedures/types';

export default function DatasetPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('procedure');
  
  // --- STATE PROCÉDURE (Standard CRF) ---
  const [procTitle, setProcTitle] = useState('');
  const [procCode, setProcCode] = useState('');
  const [category, setCategory] = useState('OPERATION');
  const [department, setDepartment] = useState('PRODUCTION');
  const [criticality, setCriticality] = useState('MEDIUM');
  const [procSteps, setProcSteps] = useState<ProcedureStep[]>([]);

  // --- STATE Q/R Sémantique ---
  const [qaTitle, setQaTitle] = useState('');
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');
  const [qaTags, setQaTags] = useState('');
  const [qaCategory, setQaCategory] = useState('Sécurité');

  useEffect(() => { 
    setMounted(true); 
    const initialStep: ProcedureStep = { 
      id: `step-${Date.now()}`, 
      order: 1,
      title: '', 
      subtitle: '', 
      description: '',
      duration: { value: 60, unit: 'seconds', display: '1 minute', type: 'fixed' },
      action: {
        type: 'confirmation',
        instruction: '',
        ui: { component: 'action_button', label: 'CONFIRMER', icon: 'check_circle' }
      },
      validation: { 
        conditions: [], 
        successExpression: 'status == OK', 
        timeout: { value: 300, unit: 'seconds', action: 'warn' } 
      },
      alarms: [],
      fallbacks: [],
      media: {},
      notes: [],
      dependencies: { prerequisites: [], dependsOn: [], requiresConfirmation: true }
    };
    setProcSteps([initialStep]);
  }, []);

  // --- MOTEUR VOCAL POUR DICTÉE ---
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
  const voice = useVoice({
    onResult: (text) => {
      if (activeVoiceField === 'qaAnswer') setQaAnswer(text);
      if (activeVoiceField?.startsWith('step-desc-')) {
        const index = parseInt(activeVoiceField.split('-')[2]);
        const n = [...procSteps];
        if (n[index]) {
          n[index].description = text;
          setProcSteps(n);
        }
      }
    },
    autoRestart: true
  });

  const toggleDictation = (fieldId: string) => {
    if (voice.isListening && activeVoiceField === fieldId) {
      voice.stopListening();
      setActiveVoiceField(null);
    } else {
      setActiveVoiceField(fieldId);
      voice.startListening();
    }
  };

  const handleForgeProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;
    
    if (!procTitle.trim() || procSteps.some(s => !s.title.trim())) {
      toast({ title: "Données incomplètes", description: "Le titre et les étapes sont requis.", variant: "destructive" });
      return;
    }

    const ts = new Date().toLocaleTimeString();
    console.log(`🚀 [FORGE] [INIT] [${ts}] Lancement de la forge procédure.`);
    setIsUploading(true);

    try {
      const payload = {
        title: procTitle,
        metadata: { 
          title: procTitle, 
          code: procCode || `PROC-${Date.now()}`, 
          category, 
          department, 
          criticality, 
          version: "1.0.0",
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          tags: [],
          language: 'fr-FR',
          author: { id: 'admin', name: 'Admin', role: 'admin', department: 'IT' }
        },
        prerequisites: { description: "Audit des conditions réelles", items: [] },
        steps: procSteps.map((s, i) => ({ ...s, order: i + 1 })),
      };

      const res = await fetch('/api/procedures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        console.log(`✅ [FORGE] [SUCCESS] [${ts}] Actif procédure forgé.`);
        toast({ title: "PROCÉDURE FORGÉE", description: data.message });
        router.push('/procedures');
      } else {
        throw new Error(data.message || data.error || "REJET_BACKEND");
      }
    } catch (err: any) {
      console.error(`❌ [FORGE] [ERROR] [${ts}]`, err.message);
      toast({ title: "ÉCHEC DE LA FORGE", description: err.message, variant: "destructive" });
    } finally { 
      setIsUploading(false); 
    }
  };

  const handleForgeQA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;
    
    if (!qaTitle.trim() || !qaQuestion.trim() || !qaAnswer.trim()) {
      toast({ title: "Données incomplètes", description: "Tous les champs Q/R sont requis.", variant: "destructive" });
      return;
    }

    const ts = new Date().toLocaleTimeString();
    console.log(`🧠 [RAG] [INIT] [${ts}] Injection sémantique Q/R.`);
    setIsUploading(true);

    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'qa',
          title: qaTitle,
          question: qaQuestion,
          answer: qaAnswer,
          tags: qaTags.split(',').map(t => t.trim()).filter(t => t),
          category: qaCategory,
          isPublic: true
        }),
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        console.log(`✅ [RAG] [SUCCESS] [${ts}] Item de connaissance indexé.`);
        toast({ title: "CONNAISSANCE INDEXÉE", description: "L'item est prêt pour le RAG." });
        setQaTitle(''); setQaQuestion(''); setQaAnswer(''); setQaTags('');
      } else {
        throw new Error(data.error || "ERREUR_INDEXATION");
      }
    } catch (err: any) {
      console.error(`❌ [RAG] [ERROR] [${ts}]`, err.message);
      toast({ title: "ÉCHEC Q/R", description: err.message, variant: "destructive" });
    } finally { 
      setIsUploading(false); 
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
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Station de Forge Industrielle</span>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
                <span className="text-[9px] font-code text-secondary uppercase font-bold tracking-tighter">Moteur Neon Actif</span>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto terminal-scroll p-4 lg:p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-muted/20 border border-border p-1 mb-8">
                <TabsTrigger value="procedure" className="px-8 text-[10px] font-bold uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Layers className="w-3.5 h-3.5 mr-2" /> Séquençage Procédure (CRF)
                </TabsTrigger>
                <TabsTrigger value="qa" className="px-8 text-[10px] font-bold uppercase data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
                  <MessageSquare className="w-3.5 h-3.5 mr-2" /> Base Q/R Sémantique
                </TabsTrigger>
              </TabsList>

              <TabsContent value="procedure">
                <form onSubmit={handleForgeProcedure} className="space-y-8 pb-24">
                  <Card className="p-6 border-primary/20 bg-black/40 space-y-6 shadow-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-primary uppercase tracking-widest">Actif Principal</label>
                        <Input 
                          value={procTitle} 
                          onChange={e => setProcTitle(e.target.value)} 
                          placeholder="TITRE DE LA PROCÉDURE" 
                          className="h-12 uppercase font-bold text-base border-primary/30 bg-black/60" 
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <Input value={procCode} onChange={e => setProcCode(e.target.value)} placeholder="CODE CRF" className="h-10 font-code uppercase text-xs" />
                          <select value={category} onChange={e => setCategory(e.target.value)} className="h-10 bg-black/60 border border-border rounded-md px-3 text-[10px] font-bold uppercase text-white outline-none">
                            <option value="STARTUP">DÉMARRAGE</option>
                            <option value="SHUTDOWN">ARRÊT</option>
                            <option value="MAINTENANCE">MAINTENANCE</option>
                            <option value="EMERGENCY">URGENCE</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Audit & Criticité</label>
                        <div className="grid grid-cols-2 gap-3">
                          <select value={department} onChange={e => setDepartment(e.target.value)} className="h-10 bg-black/60 border border-border rounded-md px-3 text-[10px] font-bold uppercase text-white">
                            <option value="PRODUCTION">PRODUCTION</option>
                            <option value="MAINTENANCE">MAINTENANCE</option>
                          </select>
                          <select value={criticality} onChange={e => setCriticality(e.target.value)} className={cn("h-10 bg-black/60 border rounded-md px-3 text-[10px] font-bold uppercase", criticality === 'CRITICAL' ? "border-red-500 text-red-500" : "text-white")}>
                            <option value="LOW">BASSE</option>
                            <option value="MEDIUM">MOYENNE</option>
                            <option value="HIGH">HAUTE</option>
                            <option value="CRITICAL">CRITIQUE</option>
                          </select>
                        </div>
                        <Textarea placeholder="Description industrielle (Périmètre)..." className="h-20 text-xs bg-black/20 font-code" />
                      </div>
                    </div>
                  </Card>

                  <div className="space-y-6">
                    {procSteps.map((step, index) => (
                      <Card key={step.id} className="p-6 border-border bg-black/40 space-y-6 relative group shadow-xl">
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-all" />
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <span className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary font-code">{index + 1}</span>
                            <Input 
                              value={step.title} 
                              onChange={e => { const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n); }} 
                              placeholder="TITRE DE L'ACTION" 
                              className="h-9 text-sm uppercase font-bold bg-transparent border-none p-0 focus-visible:ring-0 min-w-[300px]" 
                            />
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => { const n = [...procSteps]; n.splice(index, 1); setProcSteps(n); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Instruction Opérateur</label>
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => toggleDictation(`step-desc-${index}`)}
                                className={cn("h-7 text-[8px] uppercase", voice.isListening && activeVoiceField === `step-desc-${index}` ? "text-red-500 animate-pulse" : "text-primary")}
                              >
                                <Mic className="w-3 h-3 mr-1" /> Dictée
                              </Button>
                            </div>
                            <Textarea 
                              value={step.description} 
                              onChange={e => { const n = [...procSteps]; n[index].description = e.target.value; setProcSteps(n); }} 
                              placeholder="Détailler l'action technique..." 
                              className="h-24 text-xs font-code bg-black/20 resize-none border-border/50" 
                            />
                            <div className="grid grid-cols-2 gap-3">
                               <Button type="button" variant="outline" className="h-10 text-[9px] uppercase font-bold border-primary/20"><Camera className="w-4 h-4 mr-2" /> Image</Button>
                               <Button type="button" variant="outline" className="h-10 text-[9px] uppercase font-bold border-secondary/20"><Video className="w-4 h-4 mr-2" /> Vidéo</Button>
                            </div>
                          </div>
                          
                          <div className="space-y-4 p-4 bg-muted/10 rounded-sm border border-border">
                            <div className="flex items-center justify-between mb-2">
                               <span className="text-[9px] font-bold uppercase text-primary">Contrôle de Flux</span>
                               <Badge variant="outline" className="text-[8px] font-code">Standard CRF</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                               <div className="space-y-1">
                                  <span className="text-[8px] font-bold uppercase text-muted-foreground">Type d'Action</span>
                                  <select 
                                    className="w-full h-8 bg-black/40 border border-border rounded text-[9px] font-bold uppercase outline-none"
                                    value={step.action.type}
                                    onChange={e => { 
                                      const n = [...procSteps]; 
                                      n[index].action.type = e.target.value as any; 
                                      setProcSteps(n); 
                                    }}
                                  >
                                     <option value="confirmation">CONFIRMATION</option>
                                     <option value="command">COMMANDE</option>
                                     <option value="valve_operation">VALVE / VANNE</option>
                                     <option value="wait">ATTENTE</option>
                                  </select>
                               </div>
                               <div className="space-y-1">
                                  <span className="text-[8px] font-bold uppercase text-muted-foreground">Monitoring</span>
                                  <div className="h-8 bg-black/20 border border-dashed border-border rounded flex items-center justify-center cursor-pointer hover:bg-black/40 transition-colors">
                                     <Plus className="w-3 h-3 text-muted-foreground" />
                                  </div>
                               </div>
                            </div>
                            <div className="pt-4 border-t border-border/50">
                               <p className="text-[8px] font-bold text-red-500 uppercase flex items-center gap-2"><AlertTriangle className="w-3 h-3" /> Alarmes : {step.alarms?.length || 0}</p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        const newStep: ProcedureStep = { 
                          id: `step-${Date.now()}`, 
                          order: procSteps.length + 1,
                          title: '', 
                          description: '', 
                          action: { type: 'confirmation', instruction: '', ui: { component: 'action_button', label: 'CONFIRM' } }, 
                          validation: { conditions: [], successExpression: 'status == OK', timeout: { value: 300, unit: 'seconds', action: 'warn' } },
                          alarms: [],
                          fallbacks: [],
                          duration: { value: 60, unit: 'seconds', display: '1 min', type: 'fixed' },
                          media: {},
                          notes: [],
                          dependencies: { prerequisites: [], dependsOn: [], requiresConfirmation: true }
                        };
                        setProcSteps([...procSteps, newStep]);
                      }} 
                      className="w-full border-dashed border-primary/20 h-16 text-[10px] uppercase font-bold hover:bg-primary/5 transition-all"
                    >
                      <Plus className="w-4 h-4 mr-2 text-primary" /> Ajouter Séquence Opérationnelle
                    </Button>
                    <Button type="submit" disabled={isUploading} className="w-full h-16 bg-primary text-primary-foreground font-headline font-bold text-sm uppercase shadow-2xl">
                      {isUploading ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <Save className="w-6 h-6 mr-3" />}
                      FORGER L'ACTIF INDUSTRIEL
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="qa">
                <form onSubmit={handleForgeQA} className="space-y-6 max-w-4xl mx-auto pb-24">
                  <Card className="p-8 border-secondary/20 bg-black/40 space-y-6 shadow-2xl">
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                      <BookOpen className="w-6 h-6 text-secondary" />
                      <div>
                        <h3 className="text-xl font-headline font-bold uppercase text-white">Item de Connaissance</h3>
                        <p className="text-[10px] font-code text-muted-foreground uppercase">Indexation sémantique pour l'IA Guide</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Titre de Référence</label>
                          <Input value={qaTitle} onChange={e => setQaTitle(e.target.value)} placeholder="EX: SÉCURITÉ POMPE CRF" className="h-12 bg-black/60 border-secondary/20 font-bold uppercase text-sm" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Catégorie</label>
                          <Input value={qaCategory} onChange={e => setQaCategory(e.target.value)} placeholder="EX: OPÉRATION, SÉCURITÉ..." className="h-12 bg-black/60 border-border uppercase text-xs" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Question du Technicien</label>
                        <Input value={qaQuestion} onChange={e => setQaQuestion(e.target.value)} placeholder="Quelle est la consigne si..." className="h-12 bg-black/60 border-border text-sm" />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Réponse de l'Audit</label>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => toggleDictation('qaAnswer')}
                            className={cn("h-7 text-[8px] uppercase", voice.isListening && activeVoiceField === 'qaAnswer' ? "text-red-500 animate-pulse" : "text-secondary")}
                          >
                            <Mic className="w-3 h-3 mr-1" /> Dictée Vocale
                          </Button>
                        </div>
                        <Textarea value={qaAnswer} onChange={e => setQaAnswer(e.target.value)} placeholder="Rédigez la réponse technique précise ici..." className="h-40 bg-black/60 border-border text-sm leading-relaxed" />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mots-clés (tags)</label>
                        <Input value={qaTags} onChange={e => setQaTags(e.target.value)} placeholder="crf, sécurité, vanne..." className="h-10 bg-black/20 border-border font-code text-xs" />
                      </div>
                    </div>

                    <Button type="submit" disabled={isUploading} className="w-full h-16 bg-secondary text-secondary-foreground font-headline font-bold text-sm uppercase shadow-xl">
                      {isUploading ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <Zap className="w-6 h-6 mr-3" />}
                      INJECTER DANS LA MÉMOIRE RAG
                    </Button>
                  </Card>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
