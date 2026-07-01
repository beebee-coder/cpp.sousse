"use client";

import { useState, useEffect } from 'react';
import { 
  Database, Plus, Loader2, Trash2, 
  Zap, CheckCircle2, X
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface DictationStep {
  id: string;
  title: string;
  duration: string;
  description: string;
}

export default function DatasetPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [procTitle, setProcTitle] = useState('');
  const [category, setCategory] = useState('OPERATION');
  const [procSteps, setProcSteps] = useState<DictationStep[]>([
    { id: '1', title: '', duration: '60', description: '' }
  ]);

  useEffect(() => { setMounted(true); }, []);

  const handleForge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;

    const ts = new Date().toLocaleTimeString();
    console.log(`⚒️ [FORGE_FRONT] [INIT] [${ts}] Lancement de la forge.`);

    if (!procTitle.trim() || procSteps.some(s => !s.title.trim())) {
      toast({ title: "Données incomplètes", description: "Le titre et les étapes sont requis.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const payload = {
        title: procTitle,
        steps: procSteps.map((s, i) => ({
          id: `step-${Date.now()}-${i}`,
          order: i + 1,
          title: s.title.toUpperCase(),
          description: s.description || "Instruction technique.",
          duration: { value: parseInt(s.duration) || 60, unit: "seconds", display: `${s.duration}s`, type: "fixed" },
          action: { type: "confirmation", instruction: s.description || s.title, ui: { component: "button", label: "Confirmer" } },
          validation: { conditions: [], successExpression: "status == OK", timeout: { value: 300, unit: "seconds", action: "warn" } },
          dependencies: { prerequisites: [], dependsOn: [], requiresConfirmation: true }
        })),
        metadata: { 
          category: category.toUpperCase(), 
          department: "PRODUCTION", 
          version: "1.0.0",
          criticality: "MEDIUM"
        }
      };

      console.log(`⚒️ [FORGE_FRONT] [STEP] Transmission du payload...`, payload);

      const res = await fetch('/api/procedures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        console.log(`✅ [FORGE_FRONT] [SUCCESS] Forge validée : ${data.traceId}`);
        toast({ title: "Actif Forgé", description: data.message });
        router.push('/procedures');
      } else {
        throw new Error(data.message || "Le centre de forge a rejeté la demande.");
      }
    } catch (err: any) {
      console.error(`❌ [FORGE_FRONT] [ERROR] Échec :`, err.message);
      toast({ title: "Échec de la Forge", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const addStep = () => {
    setProcSteps([...procSteps, { id: Date.now().toString(), title: '', duration: '60', description: '' }]);
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
            <span className="text-[10px] font-code text-muted-foreground uppercase">Mode : Séquençage Réel</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto terminal-scroll p-4 lg:p-8">
          <form onSubmit={handleForge} className="max-w-4xl mx-auto space-y-8">
            <Card className="p-4 bg-primary/5 border border-primary/20 flex items-center gap-4">
               <Zap className="w-6 h-6 text-primary animate-pulse" />
               <p className="text-[10px] font-code text-muted-foreground uppercase leading-tight">
                 Système de forge actif. Chaque actif sera archivé dans le registre physique (.registry/) et indexé en base Neon.
               </p>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-bold text-primary uppercase tracking-widest block">Intitulé de la Procédure</label>
                <Input 
                  value={procTitle} 
                  onChange={(e) => setProcTitle(e.target.value)} 
                  placeholder="EX: DÉMARRAGE POMPE CRF..." 
                  className="bg-black/60 uppercase font-bold border-primary/30 h-12" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Catégorie</label>
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-12 bg-black/60 border border-border rounded-md px-3 text-[10px] font-bold uppercase outline-none focus:border-primary/50"
                >
                  <option value="OPERATION">OPÉRATION</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="SAFETY">SÉCURITÉ</option>
                  <option value="EMERGENCY">URGENCE</option>
                </select>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">Séquençage Opérationnel</h3>
              
              {procSteps.map((step, index) => (
                <Card key={step.id} className="p-6 border-border bg-black/30 space-y-4 relative group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary/50 group-hover:bg-primary transition-all" />
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                       <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-[10px] font-bold text-primary font-code">{index + 1}</span>
                       <span className="text-[10px] font-bold text-white uppercase tracking-wider">Séquence {index + 1}</span>
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

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-3">
                      <Input 
                        value={step.title} 
                        onChange={(e) => { const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n); }} 
                        placeholder="TITRE DE L'ACTION" 
                        className="h-10 text-[10px] uppercase font-bold bg-black/20" 
                      />
                    </div>
                    <div>
                      <div className="relative">
                        <Input 
                          value={step.duration} 
                          onChange={(e) => { const n = [...procSteps]; n[index].duration = e.target.value; setProcSteps(n); }} 
                          placeholder="60" 
                          className="h-10 text-[10px] font-code bg-black/20 pr-8" 
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-bold text-muted-foreground">SEC</span>
                      </div>
                    </div>
                  </div>

                  <Textarea 
                    value={step.description} 
                    onChange={(e) => { const n = [...procSteps]; n[index].description = e.target.value; setProcSteps(n); }} 
                    placeholder="INSTRUCTIONS TECHNIQUES DÉTAILLÉES POUR L'OPÉRATEUR..." 
                    className="h-24 text-[10px] uppercase font-code bg-black/20 resize-none border-border/50" 
                  />
                </Card>
              ))}

              <Button 
                type="button" 
                variant="outline" 
                onClick={addStep} 
                className="w-full border-dashed border-primary/20 h-14 text-[10px] uppercase font-bold hover:bg-primary/5 hover:border-primary/40"
              >
                <Plus className="w-4 h-4 mr-2" /> Ajouter une Séquence au Registre
              </Button>

              <div className="pt-8 border-t border-border/50">
                <Button 
                  type="submit" 
                  disabled={isUploading} 
                  className="w-full font-headline font-bold uppercase text-xs h-16 bg-primary text-primary-foreground shadow-[0_0_30px_rgba(50,181,212,0.3)] transition-all active:scale-[0.98]"
                >
                  {isUploading ? (
                    <Loader2 className="w-6 h-6 animate-spin mr-3" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 mr-3" />
                  )}
                  {isUploading ? "Forge en cours..." : "Forger l'Actif Industriel"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
