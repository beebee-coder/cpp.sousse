"use client";

import { useState, useEffect } from 'react';
import { 
  Database, Plus, Loader2, Trash2, 
  Zap, CheckCircle2, Layers, ShieldAlert,
  Info, Camera, Video, AlertTriangle, Activity, Settings2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface ForgeCondition {
  id: string;
  displayName: string;
  operator: string;
  value: string;
  unit: string;
}

interface ForgeAlarm {
  id: string;
  code: string;
  severity: string;
  description: string;
}

interface DictationStep {
  id: string;
  title: string;
  subtitle: string;
  duration: string;
  description: string;
  actionType: 'confirmation' | 'valve_operation' | 'command' | 'wait';
  target?: string;
  conditions: ForgeCondition[];
  alarms: ForgeAlarm[];
  imageUrl?: string;
  videoUrl?: string;
}

export default function DatasetPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [procTitle, setProcTitle] = useState('');
  const [category, setCategory] = useState('OPERATION');
  const [procSteps, setProcSteps] = useState<DictationStep[]>([
    { 
      id: '1', 
      title: '', 
      subtitle: '', 
      duration: '60', 
      description: '', 
      actionType: 'confirmation',
      conditions: [],
      alarms: []
    }
  ]);

  useEffect(() => { setMounted(true); }, []);

  const handleForge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;

    const ts = new Date().toLocaleTimeString();
    console.log(`⚒️ [FORGE_FRONT] [INIT] Lancement de la forge à ${ts}`);

    if (!procTitle.trim() || procSteps.some(s => !s.title.trim())) {
      toast({ title: "Données incomplètes", description: "Le titre et les étapes sont requis.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const payload = {
        title: procTitle,
        category: category,
        steps: procSteps.map((s, i) => ({
          id: `step-${Date.now()}-${i}`,
          order: i + 1,
          title: s.title.toUpperCase(),
          subtitle: s.subtitle || "",
          description: s.description || "Instruction technique standard.",
          duration: { 
            value: parseInt(s.duration) || 60, 
            unit: "seconds", 
            display: `${s.duration}s`, 
            type: "fixed" 
          },
          action: { 
            type: s.actionType, 
            instruction: s.description || s.title,
            target: s.target ? parseInt(s.target) : undefined,
            ui: { 
              component: "action_button", 
              label: s.actionType === 'valve_operation' ? `RÉGLER À ${s.target}%` : "CONFIRMER SÉQUENCE",
              color: s.actionType === 'valve_operation' ? 'primary' : 'success'
            } 
          },
          validation: { 
            conditions: s.conditions.map(c => ({
              ...c,
              id: c.id || `cond-${Date.now()}`,
              type: 'numeric',
              monitoring: true
            })), 
            successExpression: "status == OK", 
            timeout: { value: 300, unit: "seconds", action: "warn" } 
          },
          alarms: s.alarms.map(a => ({
            ...a,
            id: a.id || `alarm-${Date.now()}`,
            type: 'CRITICAL',
            remedy: { title: "Protocole de secours", steps: ["Arrêt d'urgence", "Vérification manuelle"], estimatedTime: 120 }
          })),
          media: {
            image: s.imageUrl,
            video: s.videoUrl
          },
          dependencies: { prerequisites: [], dependsOn: [], requiresConfirmation: true }
        })),
        metadata: { 
          category: category.toUpperCase(), 
          department: "PRODUCTION", 
          version: "1.0.0",
          criticality: "MEDIUM",
          description: `Généré via Station de Forge - ${ts}`,
          tags: ["forge_direct", category.toLowerCase()]
        }
      };

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
      id: Date.now().toString(), 
      title: '', 
      subtitle: '',
      duration: '60', 
      description: '',
      actionType: 'confirmation',
      conditions: [],
      alarms: []
    }]);
  };

  const addCondition = (stepIndex: number) => {
    const next = [...procSteps];
    next[stepIndex].conditions.push({ id: Date.now().toString(), displayName: '', operator: '>', value: '', unit: '' });
    setProcSteps(next);
  };

  const addAlarm = (stepIndex: number) => {
    const next = [...procSteps];
    next[stepIndex].alarms.push({ id: Date.now().toString(), code: '', severity: 'HIGH', description: '' });
    setProcSteps(next);
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
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-code text-muted-foreground uppercase px-3 py-1 border border-border rounded-sm bg-black/20">Moteur V6.1 Audit Actif</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto terminal-scroll p-4 lg:p-8 bg-[radial-gradient(circle_at_50%_0%,rgba(50,181,212,0.05),transparent_50%)]">
          <form onSubmit={handleForge} className="max-w-5xl mx-auto space-y-8">
            <Card className="p-4 bg-primary/5 border border-primary/20 flex items-center gap-4 shadow-inner">
               <Zap className="w-6 h-6 text-primary animate-pulse" />
               <p className="text-[10px] font-code text-muted-foreground uppercase leading-relaxed tracking-wider">
                 SYSTÈME DE FORGE OBLIGATOIRE. TOUT ACTIF EST ARCHIVÉ DANS LE REGISTRE PHYSIQUE ET INDEXÉ POUR L'AUDIT IA.
               </p>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-bold text-primary uppercase tracking-widest block">Intitulé de la Procédure</label>
                <Input 
                  value={procTitle} 
                  onChange={(e) => setProcTitle(e.target.value)} 
                  placeholder="EX: DÉMARRAGE POMPE CRF..." 
                  className="bg-black/60 uppercase font-bold border-primary/30 h-12 text-sm focus:border-primary" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Catégorie</label>
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-12 bg-black/60 border border-border rounded-md px-3 text-[10px] font-bold uppercase outline-none focus:border-primary/50 text-white"
                >
                  <option value="OPERATION">OPÉRATION</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="SAFETY">SÉCURITÉ</option>
                  <option value="EMERGENCY">URGENCE</option>
                </select>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Layers className="w-4 h-4 text-secondary" />
                  Séquençage Opérationnel
                </h3>
              </div>
              
              {procSteps.map((step, index) => (
                <Card key={step.id} className="p-6 border-border bg-black/30 space-y-6 relative group hover:border-primary/30 transition-all shadow-xl">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-all" />
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                       <span className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-[10px] font-bold text-primary font-code">{index + 1}</span>
                       <span className="text-[10px] font-bold text-white uppercase tracking-wider">Séquence Opérationnelle {index + 1}</span>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => { const n = [...procSteps]; n.splice(index, 1); setProcSteps(n); }} 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-[8px] font-bold text-muted-foreground uppercase mb-1.5 block">Action de Séquence</label>
                        <Input 
                          value={step.title} 
                          onChange={(e) => { const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n); }} 
                          placeholder="TITRE DE L'ACTION" 
                          className="h-10 text-[10px] uppercase font-bold bg-black/40 border-border/50" 
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          className={cn("h-10 text-[8px] uppercase font-bold border-border/40", step.imageUrl && "border-primary text-primary")}
                          onClick={() => {
                            const url = prompt("URL de l'image de référence :");
                            if (url !== null) { const n = [...procSteps]; n[index].imageUrl = url; setProcSteps(n); }
                          }}
                        >
                          <Camera className="w-3.5 h-3.5 mr-2" /> Image
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          className={cn("h-10 text-[8px] uppercase font-bold border-border/40", step.videoUrl && "border-secondary text-secondary")}
                          onClick={() => {
                            const url = prompt("URL de la vidéo de démonstration :");
                            if (url !== null) { const n = [...procSteps]; n[index].videoUrl = url; setProcSteps(n); }
                          }}
                        >
                          <Video className="w-3.5 h-3.5 mr-2" /> Vidéo
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[8px] font-bold text-muted-foreground uppercase mb-1.5 block">Durée Estimée</label>
                          <div className="relative">
                            <Input 
                              value={step.duration} 
                              onChange={(e) => { const n = [...procSteps]; n[index].duration = e.target.value; setProcSteps(n); }} 
                              placeholder="60" 
                              className="h-10 text-[10px] font-code bg-black/40 pr-8" 
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-bold text-muted-foreground">SEC</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-[8px] font-bold text-muted-foreground uppercase mb-1.5 block">Mode Action</label>
                          <select 
                            value={step.actionType} 
                            onChange={(e) => { const n = [...procSteps]; n[index].actionType = e.target.value as any; setProcSteps(n); }}
                            className="w-full h-10 bg-black/40 border border-border/50 rounded-md px-2 text-[10px] font-bold uppercase text-white outline-none focus:border-primary/40"
                          >
                            <option value="confirmation">CONFIRMATION</option>
                            <option value="valve_operation">VANNE / VALVE</option>
                            <option value="command">COMMANDE</option>
                            <option value="wait">ATTENTE</option>
                          </select>
                        </div>
                      </div>

                      {step.actionType === 'valve_operation' && (
                        <div className="animate-in slide-in-from-top-2 duration-300">
                          <label className="text-[8px] font-bold text-primary uppercase mb-1.5 block">Ouverture Cible (%)</label>
                          <Input 
                            type="number"
                            value={step.target || ''} 
                            onChange={(e) => { const n = [...procSteps]; n[index].target = e.target.value; setProcSteps(n); }} 
                            placeholder="EX: 30" 
                            className="h-10 text-[11px] font-code bg-primary/5 border-primary/30 text-primary" 
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Section Conditions */}
                    <div className="space-y-3 p-3 bg-black/20 border border-border/30 rounded-sm">
                      <div className="flex items-center justify-between">
                         <h4 className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                           <Activity className="w-3 h-3 text-primary" /> Conditions Monitoring
                         </h4>
                         <button type="button" onClick={() => addCondition(index)} className="text-[8px] font-bold text-primary uppercase hover:underline">+ Ajouter</button>
                      </div>
                      <div className="space-y-2">
                        {step.conditions.map((cond, ci) => (
                          <div key={cond.id} className="grid grid-cols-4 gap-2">
                            <Input placeholder="NOM" value={cond.displayName} onChange={e => { const n = [...procSteps]; n[index].conditions[ci].displayName = e.target.value; setProcSteps(n); }} className="h-7 text-[8px] uppercase bg-black/40" />
                            <Input placeholder="OP" value={cond.operator} onChange={e => { const n = [...procSteps]; n[index].conditions[ci].operator = e.target.value; setProcSteps(n); }} className="h-7 text-[8px] bg-black/40 text-center" />
                            <Input placeholder="VAL" value={cond.value} onChange={e => { const n = [...procSteps]; n[index].conditions[ci].value = e.target.value; setProcSteps(n); }} className="h-7 text-[8px] bg-black/40" />
                            <Input placeholder="UNITE" value={cond.unit} onChange={e => { const n = [...procSteps]; n[index].conditions[ci].unit = e.target.value; setProcSteps(n); }} className="h-7 text-[8px] bg-black/40" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section Alarmes */}
                    <div className="space-y-3 p-3 bg-red-950/10 border border-red-900/30 rounded-sm">
                      <div className="flex items-center justify-between">
                         <h4 className="text-[8px] font-bold text-red-500/70 uppercase tracking-widest flex items-center gap-2">
                           <AlertTriangle className="w-3 h-3 text-red-500" /> Protocoles Alarme
                         </h4>
                         <button type="button" onClick={() => addAlarm(index)} className="text-[8px] font-bold text-red-500 uppercase hover:underline">+ Ajouter</button>
                      </div>
                      <div className="space-y-2">
                        {step.alarms.map((alarm, ai) => (
                          <div key={alarm.id} className="flex gap-2">
                            <Input placeholder="CODE" value={alarm.code} onChange={e => { const n = [...procSteps]; n[index].alarms[ai].code = e.target.value; setProcSteps(n); }} className="h-7 w-20 text-[8px] uppercase bg-black/40" />
                            <Input placeholder="DESCRIPTION" value={alarm.description} onChange={e => { const n = [...procSteps]; n[index].alarms[ai].description = e.target.value; setProcSteps(n); }} className="h-7 flex-1 text-[8px] bg-black/40" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[8px] font-bold text-muted-foreground uppercase mb-1.5 block">Instructions techniques détaillées</label>
                    <Textarea 
                      value={step.description} 
                      onChange={(e) => { const n = [...procSteps]; n[index].description = e.target.value; setProcSteps(n); }} 
                      placeholder="INSTRUCTIONS OPÉRATIONNELLES DÉTAILLÉES POUR L'AUDIT..." 
                      className="h-24 text-[10px] uppercase font-code bg-black/20 resize-none border-border/50 focus:border-primary/30" 
                    />
                  </div>
                </Card>
              ))}

              <Button 
                type="button" 
                variant="outline" 
                onClick={addStep} 
                className="w-full border-dashed border-primary/20 h-16 text-[10px] uppercase font-bold hover:bg-primary/5 hover:border-primary/40 group transition-all"
              >
                <Plus className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" /> 
                Ajouter une Séquence Opérationnelle au Registre
              </Button>

              <div className="pt-8 border-t border-border/50">
                <Button 
                  type="submit" 
                  disabled={isUploading} 
                  className="w-full font-headline font-bold uppercase text-sm h-16 bg-primary text-primary-foreground shadow-[0_0_30px_rgba(50,181,212,0.3)] transition-all active:scale-[0.98] hover:shadow-[0_0_40px_rgba(50,181,212,0.4)]"
                >
                  {isUploading ? (
                    <Loader2 className="w-6 h-6 animate-spin mr-3" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 mr-3" />
                  )}
                  {isUploading ? "Forge en cours..." : "FORGER L'ACTIF ET ARCHIVER DANS LE REGISTRE"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
