"use client";

/**
 * @fileOverview Station de Forge Industrielle V7.9.
 * Version : Concordance V6.5 (Procédures) + Interaction Vocale + Fix Badge/Hydratation.
 */

import { useState, useEffect } from 'react';
import { 
  Database, 
  Plus, 
  Loader2, 
  Trash2, 
  Zap, 
  ShieldAlert, 
  BookOpen, 
  Save, 
  Mic, 
  MicOff,
  Activity, 
  Settings2, 
  Info, 
  FileText,
  Layers,
  ChevronRight,
  Sparkles
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
  
  // --- ÉTAT PROCÉDURE ---
  const [procTitle, setProcTitle] = useState('');
  const [procCode, setProcCode] = useState('');
  const [category, setCategory] = useState('OPERATION');
  const [department, setDepartment] = useState('PRODUCTION');
  const [criticality, setCriticality] = useState('MEDIUM');
  const [procSteps, setProcSteps] = useState<ProcedureStep[]>([]);

  // --- ÉTAT Q/R ---
  const [qaTitle, setQaTitle] = useState('');
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');
  const [qaTags, setQaTags] = useState('');

  // Stabilisation de l'hydratation
  useEffect(() => { 
    setMounted(true); 
    const initialStep: ProcedureStep = { 
      id: `step-${Math.random().toString(36).substring(2, 9)}`, 
      order: 1,
      title: '', 
      description: '',
      duration: { value: 60, unit: 'seconds', display: '1 minute', type: 'fixed' },
      action: {
        type: 'confirmation',
        instruction: '',
        ui: { component: 'action_button', label: 'CONFIRMER', icon: 'check_circle' }
      },
      validation: { conditions: [], successExpression: 'status == OK', timeout: { value: 300, unit: 'seconds', action: 'warn' } },
      alarms: [],
      fallbacks: [],
      media: {},
      notes: [],
      dependencies: { prerequisites: [], dependsOn: [], requiresConfirmation: true }
    };
    setProcSteps([initialStep]);
  }, []);

  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
  const voice = useVoice({
    onResult: (text) => {
      if (activeVoiceField === 'qaAnswer') setQaAnswer(text);
      if (activeVoiceField?.startsWith('step-desc-')) {
        const idx = parseInt(activeVoiceField.split('-')[2]);
        setProcSteps(prev => {
          const next = [...prev];
          if (next[idx]) next[idx].description = text;
          return next;
        });
      }
    },
    autoRestart: true,
    lang: 'fr-FR'
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

  const handleAddStep = () => {
    const newStep: ProcedureStep = {
      id: `step-${Math.random().toString(36).substring(2, 9)}`,
      order: procSteps.length + 1,
      title: '',
      description: '',
      duration: { value: 60, unit: 'seconds', display: '1 minute', type: 'fixed' },
      action: {
        type: 'confirmation',
        instruction: '',
        ui: { component: 'action_button', label: 'CONFIRMER', icon: 'check_circle' }
      },
      validation: { conditions: [], successExpression: 'status == OK', timeout: { value: 300, unit: 'seconds', action: 'warn' } },
      alarms: [],
      fallbacks: [],
      media: {},
      notes: [],
      dependencies: { prerequisites: [], dependsOn: [], requiresConfirmation: true }
    };
    setProcSteps([...procSteps, newStep]);
  };

  const handleRemoveStep = (idx: number) => {
    const next = [...procSteps];
    next.splice(idx, 1);
    setProcSteps(next.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const handleUpdateStep = (idx: number, field: keyof ProcedureStep, value: any) => {
    setProcSteps(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleForgeProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!procTitle || !procCode) {
      toast({ title: "CHAMPS REQUIS", description: "Titre et Code obligatoires.", variant: "destructive" });
      return;
    }
    setIsUploading(true);

    try {
      const res = await fetch('/api/procedures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: procTitle,
          metadata: { code: procCode, category, department, criticality, version: '1.0.0' },
          steps: procSteps,
          prerequisites: { description: "Audit de conformité standard", items: [] }
        }),
      });
      
      const data = await res.json();
      if (res.ok && data.success) { 
        toast({ title: "ACTIF FORGÉ", description: `Liaison établie : ${procCode}` }); 
        router.push('/procedures'); 
      } else {
        throw new Error(data.message || "Erreur de liaison");
      }
    } catch (err: any) { 
      toast({ title: "ÉCHEC DE LA FORGE", description: err.message, variant: "destructive" }); 
    } finally { 
      setIsUploading(false); 
    }
  };

  const handleForgeQA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaTitle || !qaAnswer) {
      toast({ title: "CHAMPS REQUIS", description: "Titre et Réponse obligatoires.", variant: "destructive" });
      return;
    }
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
          category: 'SÉCURITÉ'
        }),
      });
      
      if (res.ok) { 
        toast({ title: "CONNAISSANCE INDEXÉE", description: "Mémoire sémantique Cloud mise à jour." }); 
        setQaTitle(''); setQaQuestion(''); setQaAnswer(''); setQaTags('');
      } else {
        throw new Error("Erreur de liaison sémantique");
      }
    } catch (err: any) { 
      toast({ title: "ÉCHEC D'INDEXATION", description: err.message, variant: "destructive" }); 
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
            <Database className="w-4 h-4 text-primary animate-pulse" />
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Station de Forge Industrielle</span>
          </div>
          <div className="flex items-center gap-3">
             <div className="px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-sm">
                <span className="text-[9px] font-code text-secondary uppercase font-bold tracking-tighter">PRÊT POUR INJECTION</span>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto terminal-scroll p-4 lg:p-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-6xl mx-auto">
            <TabsList className="bg-muted/20 border border-border p-1 mb-8">
              <TabsTrigger value="procedure" className="px-8 text-[10px] font-bold uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <FileText className="w-3.5 h-3.5 mr-2" /> Procédures
              </TabsTrigger>
              <TabsTrigger value="qa" className="px-8 text-[10px] font-bold uppercase data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
                <BookOpen className="w-3.5 h-3.5 mr-2" /> Liaison Q/R
              </TabsTrigger>
            </TabsList>

            <TabsContent value="procedure" className="animate-in fade-in slide-in-from-left-4 duration-500">
              <form onSubmit={handleForgeProcedure} className="space-y-8 pb-24">
                <Card className="p-6 border-primary/20 bg-black/40 space-y-6 shadow-2xl">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                           <Settings2 className="w-4 h-4 text-primary" />
                           <label className="text-[10px] font-bold text-primary uppercase tracking-widest">Identification CRF</label>
                        </div>
                        <Input 
                          value={procTitle} 
                          onChange={e => setProcTitle(e.target.value)} 
                          placeholder="TITRE DE LA PROCÉDURE" 
                          className="h-12 bg-black/40 uppercase font-headline font-bold text-sm border-primary/20" 
                        />
                        <div className="grid grid-cols-2 gap-4">
                           <Input 
                            value={procCode} 
                            onChange={e => setProcCode(e.target.value)} 
                            placeholder="CODE_REGISTRE" 
                            className="h-10 bg-black/20 font-code uppercase text-xs" 
                           />
                           <select 
                            value={category} 
                            onChange={e => setCategory(e.target.value)} 
                            className="h-10 bg-black border border-border rounded-sm px-3 text-[10px] font-bold uppercase"
                           >
                             <option value="OPERATION">OPÉRATION</option>
                             <option value="MAINTENANCE">MAINTENANCE</option>
                             <option value="STARTUP">DÉMARRAGE</option>
                             <option value="EMERGENCY">URGENCE</option>
                           </select>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                           <ShieldAlert className="w-4 h-4 text-muted-foreground" />
                           <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Audit & Criticité</label>
                        </div>
                        <div className="p-4 bg-muted/5 border border-border rounded-sm space-y-4">
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-code uppercase text-muted-foreground">Niveau Réel</span>
                              <select 
                                value={criticality} 
                                onChange={e => setCriticality(e.target.value)} 
                                className="bg-black border border-border rounded-sm px-2 py-1 text-[9px] font-bold uppercase"
                              >
                                <option value="LOW">BASSE</option>
                                <option value="MEDIUM">MOYENNE</option>
                                <option value="HIGH">HAUTE</option>
                                <option value="CRITICAL">CRITIQUE</option>
                              </select>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-code uppercase text-muted-foreground">Département</span>
                              <select 
                                value={department} 
                                onChange={e => setDepartment(e.target.value)} 
                                className="bg-black border border-border rounded-sm px-2 py-1 text-[9px] font-bold uppercase"
                              >
                                <option value="PRODUCTION">PRODUCTION</option>
                                <option value="MAINTENANCE">MAINTENANCE</option>
                                <option value="SÉCURITÉ">SÉCURITÉ</option>
                              </select>
                           </div>
                        </div>
                      </div>
                   </div>
                </Card>

                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                     <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-secondary" />
                        <h3 className="text-[10px] font-bold text-secondary uppercase tracking-widest">Séquençage Opérationnel</h3>
                     </div>
                     <Badge variant="outline" className="text-[8px] font-code border-secondary/30 text-secondary uppercase">
                       {procSteps.length} ÉTAPES DÉFINIES
                     </Badge>
                  </div>

                  {procSteps.map((step, idx) => (
                    <Card key={step.id} className="p-6 border-border bg-black/20 space-y-4 relative group hover:border-primary/30 transition-all duration-300">
                      <div className="flex justify-between items-center border-b border-border/50 pb-3">
                        <div className="flex items-center gap-3">
                           <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center text-[10px] font-bold text-primary font-code">
                             {idx + 1}
                           </span>
                           <Input 
                            value={step.title} 
                            onChange={e => handleUpdateStep(idx, 'title', e.target.value)} 
                            placeholder="TITRE DE L'ACTION" 
                            className="bg-transparent border-none focus-visible:ring-0 uppercase font-headline font-bold text-xs h-8 p-0" 
                           />
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleRemoveStep(idx)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                         <div className="space-y-2">
                           <label className="text-[9px] font-bold text-muted-foreground uppercase">Description Technique</label>
                           <div className="relative">
                              <Textarea 
                                value={step.description} 
                                onChange={e => handleUpdateStep(idx, 'description', e.target.value)} 
                                placeholder="Détailler l'opération réelle..." 
                                className="h-28 text-xs font-code bg-black/40 border-border/50 resize-none pr-10" 
                              />
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => toggleDictation(`step-desc-${idx}`)} 
                                className={cn(
                                  "absolute bottom-2 right-2 h-7 px-2 text-[8px] uppercase font-bold border border-border/50", 
                                  voice.isListening && activeVoiceField === `step-desc-${idx}` ? "text-red-500 bg-red-500/10 animate-pulse" : "text-primary"
                                )}
                              >
                                {voice.isListening && activeVoiceField === `step-desc-${idx}` ? <MicOff className="w-3.5 h-3.5 mr-1" /> : <Mic className="w-3.5 h-3.5 mr-1" />}
                                Dictée
                              </Button>
                           </div>
                         </div>

                         <div className="space-y-4">
                            <div className="p-3 bg-primary/5 border border-primary/20 rounded-sm">
                               <p className="text-[8px] font-bold text-primary uppercase mb-2 flex items-center gap-2">
                                 <Activity className="w-3 h-3" /> Monitoring & Validation
                               </p>
                               <div className="flex items-center gap-3">
                                  <select className="flex-1 bg-black border border-border rounded-sm px-2 py-1 text-[8px] font-bold uppercase text-muted-foreground">
                                    <option>CONFIRMATION MANUELLE</option>
                                    <option>VALEUR CAPTEUR (AUTO)</option>
                                    <option>RECONNAISSANCE VISUELLE</option>
                                  </select>
                                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                               </div>
                            </div>
                         </div>
                      </div>
                    </Card>
                  ))}
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleAddStep} 
                    className="w-full h-12 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 uppercase text-[10px] font-bold text-primary transition-all"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Ajouter une Action Opérationnelle
                  </Button>
                </div>

                <div className="pt-8 border-t border-border/30">
                  <Button 
                    type="submit" 
                    disabled={isUploading} 
                    className="w-full h-16 bg-primary text-primary-foreground font-headline font-bold text-sm uppercase shadow-[0_0_30px_rgba(50,181,212,0.3)] transition-all active:scale-95 group"
                  >
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 animate-spin mr-3" />
                    ) : (
                      <Sparkles className="w-6 h-6 mr-3 group-hover:animate-bounce" />
                    )}
                    Forger la Procédure dans le Registre
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="qa" className="animate-in fade-in slide-in-from-right-4 duration-500">
              <form onSubmit={handleForgeQA} className="space-y-6 max-w-4xl mx-auto pb-24">
                <Card className="p-8 border-secondary/20 bg-black/40 space-y-6 shadow-2xl">
                  <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                    <div className="w-12 h-12 rounded-sm bg-secondary/10 border border-secondary/30 flex items-center justify-center">
                       <BookOpen className="w-6 h-6 text-secondary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-headline font-bold uppercase text-white tracking-tight">Injection Sémantique</h3>
                      <p className="text-[10px] font-code text-muted-foreground uppercase tracking-widest">Base de Connaissances Move-to-Local</p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-2">
                       <label className="text-[9px] font-bold text-secondary uppercase tracking-widest">Titre de l'Item</label>
                       <Input 
                        value={qaTitle} 
                        onChange={e => setQaTitle(e.target.value)} 
                        placeholder="EX: CONSIGNES CRF PALIERS" 
                        className="h-12 bg-black/60 font-bold uppercase border-secondary/20" 
                       />
                    </div>

                    <div className="space-y-2">
                       <label className="text-[9px] font-bold text-secondary uppercase tracking-widest">Question de l'Opérateur</label>
                       <Input 
                        value={qaQuestion} 
                        onChange={e => setQaQuestion(e.target.value)} 
                        placeholder="Quelle est la température maximale ?" 
                        className="h-12 bg-black/60 border-border" 
                       />
                    </div>

                    <div className="space-y-2">
                       <label className="text-[9px] font-bold text-secondary uppercase tracking-widest">Réponse technique (Dictée possible)</label>
                       <div className="relative">
                          <Textarea 
                            value={qaAnswer} 
                            onChange={e => setQaAnswer(e.target.value)} 
                            placeholder="Saisissez ou dictez la réponse technique..." 
                            className="h-44 bg-black/60 border-border font-code text-sm leading-relaxed pr-10" 
                          />
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => toggleDictation('qaAnswer')} 
                            className={cn(
                              "absolute bottom-2 right-2 h-8 px-3 text-[9px] uppercase font-bold border border-border/50 shadow-lg", 
                              voice.isListening && activeVoiceField === 'qaAnswer' ? "text-red-500 bg-red-500/10 animate-pulse" : "text-secondary"
                            )}
                          >
                            {voice.isListening && activeVoiceField === 'qaAnswer' ? <MicOff className="w-3.5 h-3.5 mr-2" /> : <Mic className="w-3.5 h-3.5 mr-2" />}
                            Dictée
                          </Button>
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[9px] font-bold text-secondary uppercase tracking-widest">Tags d'indexation (virgules)</label>
                       <Input 
                        value={qaTags} 
                        onChange={e => setQaTags(e.target.value)} 
                        placeholder="température, alerte, CRF" 
                        className="h-10 bg-black/20 border-border font-code text-xs uppercase" 
                       />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isUploading} 
                    className="w-full h-16 bg-secondary text-secondary-foreground font-headline font-bold text-sm uppercase shadow-[0_0_30px_rgba(46,184,146,0.2)] transition-all group"
                  >
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 animate-spin mr-3" />
                    ) : (
                      <Zap className="w-6 h-6 mr-3 group-hover:scale-125 transition-transform" />
                    )}
                    Injecter dans la Mémoire Cloud
                  </Button>
                </Card>

                <div className="flex items-start gap-4 p-4 bg-secondary/5 border border-secondary/20 rounded-sm">
                   <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                   <p className="text-[10px] font-code text-muted-foreground uppercase leading-relaxed">
                     Les données Web sont considérées comme <span className="text-secondary font-bold">Provisoires</span>. Une fois la station locale connectée, elles seront automatiquement <span className="text-primary font-bold">Injectées</span> dans ChromaDB local et <span className="text-destructive font-bold">Purgées</span> du Cloud.
                   </p>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
