"use client";

import { useState, useEffect } from 'react';
import { 
  Database, Plus, Loader2, Trash2, 
  Zap, CheckCircle2, Layers, ShieldAlert,
  Info, Camera, Video, AlertTriangle, Activity, Settings2,
  ListChecks, ShieldCheck, Thermometer, Gauge
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function DatasetPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Root level data
  const [procTitle, setProcTitle] = useState('');
  const [procCode, setProcCode] = useState('');
  const [category, setCategory] = useState('OPERATION');
  const [department, setDepartment] = useState('PRODUCTION');
  const [criticality, setCriticality] = useState('MEDIUM');

  // Prerequisites
  const [prereqDesc, setPrereqDesc] = useState('Conditions obligatoires avant démarrage');
  const [prereqItems, setPrereqItems] = useState<any[]>([]);

  // Steps
  const [procSteps, setProcSteps] = useState<any[]>([
    { 
      id: `step-${Date.now()}`, 
      title: '', 
      subtitle: '', 
      duration: { value: 60, unit: 'seconds', display: '1 minute', type: 'fixed' },
      description: '', 
      action: {
        type: 'confirmation',
        instruction: '',
        ui: { component: 'action_button', label: 'CONFIRMER', icon: 'check_circle' }
      },
      validation: { conditions: [], successExpression: 'status == OK', timeout: { value: 300, unit: 'seconds', action: 'warn' } },
      alarms: [],
      media: {}
    }
  ]);

  useEffect(() => { setMounted(true); }, []);

  const handleForge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;

    if (!procTitle.trim() || procSteps.some(s => !s.title.trim())) {
      toast({ title: "Données incomplètes", description: "Le titre et les étapes sont requis.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    const ts = new Date().toISOString();

    try {
      const payload = {
        title: procTitle,
        category: category,
        prerequisites: {
          description: prereqDesc,
          items: prereqItems
        },
        steps: procSteps.map((s, i) => ({
          ...s,
          order: i + 1,
          id: s.id || `step-${Date.now()}-${i}`
        })),
        metadata: { 
          title: procTitle,
          code: procCode || `PROC-${Date.now().toString().slice(-6)}`,
          category: category,
          department: department,
          criticality: criticality,
          version: "1.0.0",
          author: { id: "admin", name: "System Admin", role: "admin", department: "IT" },
          createdAt: ts,
          lastUpdated: ts,
          tags: ["forge_v6", category.toLowerCase()],
          language: "fr-FR"
        }
      };

      console.log(`⚒️ [FORGE_FRONT] Envoi du payload structuré...`);

      const res = await fetch('/api/procedures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        toast({ title: "ACTIF FORGÉ AVEC SUCCÈS", description: data.message });
        router.push('/procedures');
      } else {
        throw new Error(data.message || "REJET_BACKEND");
      }
    } catch (err: any) {
      toast({ title: "ÉCHEC DE LA FORGE", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const addStep = () => {
    setProcSteps([...procSteps, { 
      id: `step-${Date.now()}`, 
      title: '', 
      subtitle: '', 
      duration: { value: 60, unit: 'seconds', display: '1 minute', type: 'fixed' },
      description: '', 
      action: {
        type: 'confirmation',
        instruction: '',
        ui: { component: 'action_button', label: 'CONFIRMER', icon: 'check_circle' }
      },
      validation: { conditions: [], successExpression: 'status == OK', timeout: { value: 300, unit: 'seconds', action: 'warn' } },
      alarms: [],
      media: {}
    }]);
  };

  const addPrereq = () => {
    setPrereqItems([...prereqItems, {
      id: `pr-${Date.now()}`,
      description: '',
      condition: 'status == OK',
      expectedState: 'OK',
      verificationType: 'automatic',
      displayName: 'Nouveau paramètre'
    }]);
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
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Station de Forge Industrielle V6.5</span>
          </div>
          <div className="flex items-center gap-2">
             <span className="text-[9px] font-code text-secondary uppercase px-3 py-1 border border-secondary/30 rounded-sm bg-secondary/5">Concordance Template CRF</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto terminal-scroll p-4 lg:p-8">
          <form onSubmit={handleForge} className="max-w-6xl mx-auto space-y-12 pb-24">
            
            {/* Header Metadata Section */}
            <Card className="p-8 border-primary/20 bg-black/40 space-y-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <ShieldCheck className="w-24 h-24 text-primary" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                   <label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Identification de l'Actif</label>
                   <Input 
                    value={procTitle} 
                    onChange={e => setProcTitle(e.target.value)} 
                    placeholder="TITRE DE LA PROCÉDURE" 
                    className="h-14 uppercase font-bold text-lg border-primary/30 bg-black/60 focus:border-primary"
                   />
                   <div className="grid grid-cols-2 gap-4">
                      <Input value={procCode} onChange={e => setProcCode(e.target.value)} placeholder="CODE (EX: CRF-001)" className="h-10 font-code uppercase text-xs" />
                      <select 
                        value={category} 
                        onChange={e => setCategory(e.target.value)}
                        className="bg-black/60 border border-border rounded-md px-3 text-[10px] font-bold uppercase text-white outline-none"
                      >
                        <option value="STARTUP">DÉMARRAGE</option>
                        <option value="SHUTDOWN">ARRÊT</option>
                        <option value="MAINTENANCE">MAINTENANCE</option>
                        <option value="EMERGENCY">URGENCE</option>
                      </select>
                   </div>
                </div>

                <div className="space-y-4">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Classification Audit</label>
                   <div className="grid grid-cols-2 gap-4">
                      <select 
                        value={department} 
                        onChange={e => setDepartment(e.target.value)}
                        className="h-10 bg-black/60 border border-border rounded-md px-3 text-[10px] font-bold uppercase text-white"
                      >
                        <option value="PRODUCTION">PRODUCTION</option>
                        <option value="MAINTENANCE">MAINTENANCE</option>
                        <option value="QUALITY">QUALITÉ</option>
                      </select>
                      <select 
                        value={criticality} 
                        onChange={e => setCriticality(e.target.value)}
                        className={cn(
                          "h-10 bg-black/60 border rounded-md px-3 text-[10px] font-bold uppercase",
                          criticality === 'CRITICAL' ? "border-red-500 text-red-500" : "border-border text-white"
                        )}
                      >
                        <option value="LOW">BASSE</option>
                        <option value="MEDIUM">MOYENNE</option>
                        <option value="HIGH">HAUTE</option>
                        <option value="CRITICAL">CRITIQUE</option>
                      </select>
                   </div>
                   <Textarea placeholder="Description globale du périmètre industriel..." className="h-20 text-xs bg-black/20" />
                </div>
              </div>
            </Card>

            {/* Prerequisites Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-2">
                 <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                   <ListChecks className="w-4 h-4 text-secondary" /> Conditions de Pré-Démarrage
                 </h3>
                 <Button type="button" variant="outline" size="sm" onClick={addPrereq} className="h-7 text-[8px] uppercase font-bold">
                    + Ajouter Prérequis
                 </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {prereqItems.map((item, idx) => (
                  <Card key={item.id} className="p-4 border-border bg-black/20 flex gap-4">
                     <div className="w-8 h-8 rounded-sm bg-secondary/10 flex items-center justify-center text-[10px] font-bold text-secondary">{idx + 1}</div>
                     <div className="flex-1 space-y-2">
                        <Input value={item.displayName} onChange={e => { const n = [...prereqItems]; n[idx].displayName = e.target.value; setPrereqItems(n); }} placeholder="Nom du paramètre (ex: Niveau bassin)" className="h-8 text-[10px] uppercase font-bold bg-transparent" />
                        <div className="flex gap-2">
                           <select className="h-7 text-[8px] bg-black/40 border border-border rounded px-1 uppercase text-muted-foreground">
                              <option>AUTOMATIQUE</option>
                              <option>MANUEL</option>
                           </select>
                           <Input placeholder="VAL CIBLE" className="h-7 text-[9px] w-20" />
                        </div>
                     </div>
                     <Button type="button" variant="ghost" size="icon" onClick={() => { const n = [...prereqItems]; n.splice(idx, 1); setPrereqItems(n); }} className="h-8 w-8 text-muted-foreground/30 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </Card>
                ))}
              </div>
            </div>

            {/* Steps Section */}
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b border-border pb-2">
                 <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                   <Layers className="w-4 h-4 text-primary" /> Séquençage Opérationnel
                 </h3>
              </div>

              {procSteps.map((step, index) => (
                <Card key={step.id} className="p-6 lg:p-8 border-border bg-black/40 space-y-8 relative group hover:border-primary/30 transition-all shadow-xl">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-primary/20 group-hover:bg-primary transition-all" />
                  
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                       <span className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary font-code">{index + 1}</span>
                       <div>
                          <Input 
                            value={step.title} 
                            onChange={e => { const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n); }} 
                            placeholder="TITRE DE LA SÉQUENCE" 
                            className="h-10 text-sm uppercase font-bold bg-transparent border-none p-0 focus-visible:ring-0 min-w-[300px]" 
                          />
                          <Input 
                            value={step.subtitle} 
                            onChange={e => { const n = [...procSteps]; n[index].subtitle = e.target.value; setProcSteps(n); }} 
                            placeholder="SOUS-TITRE (PHASE)" 
                            className="h-6 text-[10px] uppercase font-code text-muted-foreground bg-transparent border-none p-0 focus-visible:ring-0" 
                          />
                       </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => { const n = [...procSteps]; n.splice(index, 1); setProcSteps(n); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-5 h-5" /></Button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                     <div className="space-y-6">
                        <div className="space-y-2">
                           <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Instruction Technique</label>
                           <Textarea 
                             value={step.description} 
                             onChange={e => { const n = [...procSteps]; n[index].description = e.target.value; setProcSteps(n); }} 
                             placeholder="Détailler l'action pour l'opérateur..." 
                             className="h-32 text-xs font-code bg-black/20 resize-none border-border/50" 
                           />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <label className="text-[8px] font-bold text-muted-foreground uppercase">Mode Action</label>
                              <select 
                                value={step.action.type} 
                                onChange={e => { const n = [...procSteps]; n[index].action.type = e.target.value; setProcSteps(n); }}
                                className="w-full h-9 bg-black/40 border border-border/50 rounded-md px-2 text-[10px] font-bold uppercase"
                              >
                                <option value="confirmation">CONFIRMATION</option>
                                <option value="valve_operation">OPÉRATION VANNE</option>
                                <option value="command">COMMANDE SYSTÈME</option>
                                <option value="wait">ATTENTE STABILISATION</option>
                              </select>
                           </div>
                           {step.action.type === 'valve_operation' && (
                             <div className="space-y-2">
                                <label className="text-[8px] font-bold text-primary uppercase">Cible Ouverture (%)</label>
                                <Input type="number" placeholder="EX: 30" className="h-9 text-[11px] font-code text-primary bg-primary/5 border-primary/20" />
                             </div>
                           )}
                        </div>
                     </div>

                     <div className="space-y-6">
                        <div className="p-4 bg-black/20 border border-border/50 rounded-sm space-y-4">
                           <div className="flex items-center justify-between">
                              <label className="text-[9px] font-bold text-secondary uppercase tracking-widest flex items-center gap-2">
                                <Activity className="w-3.5 h-3.5" /> Monitoring & Validation
                              </label>
                              <Button type="button" variant="ghost" size="sm" className="h-6 text-[8px] uppercase">+ Condition</Button>
                           </div>
                           <div className="space-y-2">
                              <div className="grid grid-cols-3 gap-2">
                                 <Input placeholder="SENSOR" className="h-7 text-[8px] bg-black/40" />
                                 <Input placeholder="OP" className="h-7 text-[8px] bg-black/40 text-center" />
                                 <Input placeholder="TARGET" className="h-7 text-[8px] bg-black/40" />
                              </div>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <Button type="button" variant="outline" className="h-10 text-[9px] uppercase font-bold border-border/40 hover:border-primary/40">
                              <Camera className="w-4 h-4 mr-2" /> Ressource Image
                           </Button>
                           <Button type="button" variant="outline" className="h-10 text-[9px] uppercase font-bold border-border/40 hover:border-secondary/40">
                              <Video className="w-4 h-4 mr-2" /> Ressource Vidéo
                           </Button>
                        </div>

                        <div className="p-4 bg-red-950/10 border border-red-900/30 rounded-sm">
                           <div className="flex items-center justify-between mb-3">
                              <label className="text-[9px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-2">
                                <AlertTriangle className="w-3.5 h-3.5" /> Protocoles Alarme
                              </label>
                              <Button type="button" variant="ghost" size="sm" className="h-6 text-[8px] text-red-500 uppercase">+ Alarme</Button>
                           </div>
                           <p className="text-[8px] font-code text-red-500/50 uppercase italic">Aucune alarme spécifique configurée pour cette séquence.</p>
                        </div>
                     </div>
                  </div>
                </Card>
              ))}

              <Button 
                type="button" 
                variant="outline" 
                onClick={addStep} 
                className="w-full border-dashed border-primary/20 h-20 text-[10px] uppercase font-bold hover:bg-primary/5 group transition-all"
              >
                <Plus className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform text-primary" /> 
                Ajouter une Séquence au Registre Central
              </Button>

              <div className="pt-12 border-t border-border/50">
                <Button 
                  type="submit" 
                  disabled={isUploading} 
                  className="w-full font-headline font-bold uppercase text-base h-20 bg-primary text-primary-foreground shadow-[0_0_40px_rgba(50,181,212,0.3)] transition-all active:scale-[0.98]"
                >
                  {isUploading ? (
                    <Loader2 className="w-8 h-8 animate-spin mr-4" />
                  ) : (
                    <ShieldCheck className="w-8 h-8 mr-4" />
                  )}
                  {isUploading ? "TRANSMISSION AU REGISTRE..." : "FORGER L'ACTIF ET ARCHIVER DANS LE RÉSEAU"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
