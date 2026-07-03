
"use client";

/**
 * @fileOverview Station de Forge Industrielle V24.1 - Stabilité Prisma 5 & Fix [object Event].
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Database, 
  Plus, 
  Loader2, 
  Trash2, 
  Zap, 
  BookOpen, 
  Mic, 
  MicOff,
  FileText
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  
  const [procTitle, setProcTitle] = useState('');
  const [procCode, setProcCode] = useState('');
  const [category, setCategory] = useState('OPERATION');
  const [department, setDepartment] = useState('PRODUCTION');
  const [criticality, setCriticality] = useState('MEDIUM');
  const [procSteps, setProcSteps] = useState<ProcedureStep[]>([]);

  const [qaTitle, setQaTitle] = useState('');
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');

  useEffect(() => { 
    setMounted(true); 
    const initialStep: ProcedureStep = { 
      id: `step-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, 
      order: 1,
      title: '', 
      description: '',
      duration: { value: 60, unit: 'seconds', display: '1 minute', type: 'fixed' },
      action: {
        type: 'confirmation',
        instruction: 'Action manuelle requise',
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
  
  /**
   * ✅ FIX ANTI-SÉRIALISATION V24.1 : Extraction de valeur pure.
   * Élimine définitivement le bug "[object Event]" en extrayant target.value si présent.
   */
  const handleUpdateStepField = useCallback((idx: number, field: string, value: any) => {
    let finalValue: any = value;
    
    // Détection de l'événement React
    if (value && typeof value === 'object' && 'target' in value) {
      finalValue = value.target.value;
    }
    
    // Protection ultime contre la sérialisation circulaire
    if (typeof finalValue === 'string' && (finalValue.includes('[object Event]') || finalValue.includes('[object Object]'))) {
      return;
    }

    setProcSteps(prev => {
      const next = [...prev];
      if (!next[idx]) return prev;

      const updated = { ...next[idx] };
      
      if (field === 'action_type') {
        updated.action = { ...updated.action, type: finalValue as any };
      } else if (field === 'duration_value') {
        const num = parseInt(finalValue) || 0;
        updated.duration = { ...updated.duration, value: num, display: `${num}s` };
      } else {
        (updated as any)[field] = finalValue;
      }
      
      next[idx] = updated;
      return next;
    });
  }, []);

  const voice = useVoice({
    onResult: (text) => {
      if (activeVoiceField === 'qaAnswer') setQaAnswer(text);
      if (activeVoiceField?.startsWith('step-desc-')) {
        const parts = activeVoiceField.split('-');
        const idx = parseInt(parts[parts.length - 1]);
        if (!isNaN(idx)) handleUpdateStepField(idx, 'description', text);
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
      id: `step-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      order: procSteps.length + 1,
      title: '',
      description: '',
      duration: { value: 60, unit: 'seconds', display: '1 minute', type: 'fixed' },
      action: {
        type: 'confirmation',
        instruction: 'Action manuelle requise',
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

  const handleForgeProcedure = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
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
          metadata: { 
            code: procCode, 
            category, 
            department, 
            criticality, 
            version: '1.0.0'
          },
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
                        <label className="text-[10px] font-bold text-primary uppercase tracking-widest block">Identification CRF</label>
                        <Input 
                          value={procTitle} 
                          onChange={e => setProcTitle(e.target.value)} 
                          placeholder="TITRE DE LA PROCÉDURE" 
                          className="h-12 bg-black/40 uppercase font-headline font-bold text-sm border-primary/20" 
                        />
                        <Input 
                          value={procCode} 
                          onChange={e => setProcCode(e.target.value.toUpperCase())} 
                          placeholder="CODE_REGISTRE" 
                          className="h-10 bg-black/20 font-code uppercase text-xs" 
                        />
                      </div>
                      
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Audit & Criticité</label>
                        <div className="grid grid-cols-2 gap-4">
                           <select 
                            value={category} 
                            onChange={e => setCategory(e.target.value)} 
                            className="h-10 bg-black border border-border rounded-sm px-3 text-[10px] font-bold uppercase"
                           >
                             <option value="OPERATION">OPÉRATION</option>
                             <option value="MAINTENANCE">MAINTENANCE</option>
                             <option value="STARTUP">DÉMARRAGE</option>
                           </select>
                           <select 
                            value={criticality} 
                            onChange={e => setCriticality(e.target.value)} 
                            className="h-10 bg-black border border-border rounded-sm px-3 text-[10px] font-bold uppercase"
                           >
                             <option value="LOW">BASSE</option>
                             <option value="MEDIUM">MOYENNE</option>
                             <option value="HIGH">HAUTE</option>
                             <option value="CRITICAL">CRITIQUE</option>
                           </select>
                        </div>
                      </div>
                   </div>
                </Card>

                <div className="space-y-6">
                  {procSteps.map((step, idx) => (
                    <Card key={step.id} className="p-6 border-border bg-black/20 space-y-4">
                      <div className="flex justify-between items-center border-b border-border/50 pb-3">
                        <div className="flex items-center gap-3">
                           <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center text-[10px] font-bold text-primary font-code">
                             {idx + 1}
                           </span>
                           <Input 
                            value={step.title} 
                            onChange={e => handleUpdateStepField(idx, 'title', e)} 
                            placeholder="TITRE DE L'ACTION" 
                            className="bg-transparent border-none focus-visible:ring-0 uppercase font-headline font-bold text-xs h-8 p-0" 
                           />
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                             const next = [...procSteps];
                             next.splice(idx, 1);
                             setProcSteps(next.map((s, i) => ({ ...s, order: i + 1 })));
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                         <div className="relative">
                            <Textarea 
                              value={step.description} 
                              onChange={e => handleUpdateStepField(idx, 'description', e)} 
                              placeholder="Détailler l'opération réelle..." 
                              className="h-28 text-xs font-code bg-black/40 border-border/50 resize-none pr-10" 
                            />
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => toggleDictation(`step-desc-${idx}`)} 
                              className={cn(
                                "absolute bottom-2 right-2 h-7 px-2 text-[8px] uppercase font-bold", 
                                voice.isListening && activeVoiceField === `step-desc-${idx}` ? "text-red-500 animate-pulse" : "text-primary"
                              )}
                            >
                              {voice.isListening && activeVoiceField === `step-desc-${idx}` ? <MicOff className="w-3.5 h-3.5 mr-1" /> : <Mic className="w-3.5 h-3.5 mr-1" />}
                              Dictée
                            </Button>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-4 p-4 bg-black/20 border border-border rounded-sm">
                            <div className="space-y-1">
                               <label className="text-[8px] font-bold text-muted-foreground uppercase">Type</label>
                               <select 
                                value={step.action.type} 
                                onChange={e => handleUpdateStepField(idx, 'action_type', e)}
                                className="w-full bg-black border border-border rounded-sm h-8 text-[9px] font-bold uppercase px-2"
                               >
                                 <option value="confirmation">CONFIRMATION</option>
                                 <option value="valve_operation">VANNE / VALVE</option>
                                 <option value="command">COMMANDE</option>
                               </select>
                            </div>
                            <div className="space-y-1">
                               <label className="text-[8px] font-bold text-muted-foreground uppercase">Délai Estimé (s)</label>
                               <Input 
                                type="number" 
                                value={step.duration.value} 
                                onChange={e => handleUpdateStepField(idx, 'duration_value', e)}
                                className="h-8 bg-black/40 font-code text-[10px]"
                               />
                            </div>
                         </div>
                      </div>
                    </Card>
                  ))}
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleAddStep} 
                    className="w-full h-12 border-dashed border-primary/30 hover:border-primary/60 uppercase text-[10px] font-bold text-primary"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Ajouter une Action Opérationnelle
                  </Button>
                </div>

                <Button 
                  type="submit" 
                  disabled={isUploading} 
                  className="w-full h-16 bg-primary text-primary-foreground font-headline font-bold text-sm uppercase shadow-2xl"
                >
                  {isUploading ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <Zap className="w-6 h-6 mr-3" />}
                  Forger la Procédure dans le Registre
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="qa">
              <div className="py-20 flex flex-col items-center justify-center opacity-30">
                 <BookOpen className="w-12 h-12 mb-4" />
                 <p className="font-code text-sm uppercase tracking-widest">Module Q/R en maintenance de liaison.</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
