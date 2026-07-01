
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Database, Plus, Layers, Mic, MicOff, Sparkles, Loader2, Trash2, 
  Info, ShieldAlert, Image as ImageIcon, Video as VideoIcon, 
  Camera, CheckCircle2, Clock, Zap, X, PlayCircle
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { useVoice } from '@/hooks/use-voice';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface DictationStep {
  id: string;
  title: string;
  duration: string;
  description: string;
  conditions: string;
  alarms: string;
}

export default function DatasetPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'qa' | 'procedure'>('procedure');
  const [isUploading, setIsUploading] = useState(false);
  
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [procTitle, setProcTitle] = useState('');
  const [procSteps, setProcSteps] = useState<DictationStep[]>([
    { id: '1', title: '', duration: '60', description: '', conditions: '', alarms: '' }
  ]);

  useEffect(() => { setMounted(true); }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;

    const ts = new Date().toLocaleTimeString();
    console.log(`⚒️ [FORGE_FRONT] [INIT] [${ts}] Début de la forge.`);

    if (mode === 'procedure') {
      if (!procTitle.trim() || procSteps.some(s => !s.title.trim())) {
        toast({ title: "Données manquantes", variant: "destructive" });
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
            description: s.description || "Opération technique.",
            duration: { value: parseInt(s.duration) || 60, unit: "seconds", display: `${s.duration}s`, type: "fixed" },
            action: { type: "confirmation", instruction: s.description || s.title, ui: { component: "button", label: "Confirmer" } },
            validation: { conditions: [], successExpression: "status == OK", timeout: { value: 300, unit: "seconds", action: "warn" } }
          })),
          metadata: { category: "MAINTENANCE", department: "PRODUCTION", version: "1.0.0" }
        };

        console.log(`⚒️ [FORGE_FRONT] [STEP] [${ts}] Envoi au backend...`);
        const res = await fetch('/api/procedures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          console.log(`✅ [FORGE_FRONT] [SUCCESS] [${ts}] Forge réussie. Trace : ${data.traceId}`);
          toast({ title: "Forge réussie", description: "L'actif est archivé." });
          router.push('/procedures');
        } else {
          throw new Error(data.message || "Rejet backend.");
        }
      } catch (err: any) {
        console.error(`❌ [FORGE_FRONT] [ERROR] [${ts}] Échec :`, err.message);
        toast({ title: "Échec de la Forge", description: err.message, variant: "destructive" });
      } finally {
        setIsUploading(false);
      }
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
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Station de Forge</span>
          </div>
          <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
            <button onClick={() => setMode('qa')} className={cn("px-4 py-1 text-[9px] uppercase rounded-sm font-bold", mode === 'qa' ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>Savoir</button>
            <button onClick={() => setMode('procedure')} className={cn("px-4 py-1 text-[9px] uppercase rounded-sm font-bold", mode === 'procedure' ? "bg-secondary text-secondary-foreground" : "text-muted-foreground")}>Procédure</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto terminal-scroll p-4 lg:p-8">
          <form onSubmit={handleAddItem} className="max-w-4xl mx-auto space-y-8">
            <Card className="p-4 bg-primary/5 border border-primary/20 flex items-center gap-4">
               <Zap className="w-6 h-6 text-primary" />
               <p className="text-[10px] font-code text-muted-foreground uppercase leading-tight">
                 Liaison active vers le registre physique et l'indexation sémantique Neon.
               </p>
            </Card>

            <div className="space-y-6">
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-primary uppercase tracking-widest block">Intitulé de la procédure</label>
                <Input 
                  value={procTitle} 
                  onChange={(e) => setProcTitle(e.target.value)} 
                  placeholder="EX: DÉMARRAGE POMPE CRF..." 
                  className="bg-black/60 uppercase font-bold border-primary/30" 
                />
              </div>

              {procSteps.map((step, index) => (
                <Card key={index} className="p-6 border-border bg-black/30 space-y-4 relative">
                  <div className="absolute top-0 left-0 w-1 h-full bg-secondary" />
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-white uppercase">Séquence {index + 1}</span>
                    <Button variant="ghost" size="icon" onClick={() => { const n = [...procSteps]; n.splice(index, 1); setProcSteps(n); }} className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                  <Input 
                    value={step.title} 
                    onChange={(e) => { const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n); }} 
                    placeholder="ACTION" 
                    className="h-10 text-[10px] uppercase font-bold bg-black/20" 
                  />
                  <Textarea 
                    value={step.description} 
                    onChange={(e) => { const n = [...procSteps]; n[index].description = e.target.value; setProcSteps(n); }} 
                    placeholder="INSTRUCTIONS TECHNIQUES..." 
                    className="h-24 text-[10px] uppercase font-code bg-black/20 resize-none" 
                  />
                </Card>
              ))}

              <Button type="button" variant="outline" onClick={() => setProcSteps([...procSteps, { id: Date.now().toString(), title: '', duration: '60', description: '', conditions: '', alarms: '' }])} className="w-full border-dashed h-12 text-[10px] uppercase font-bold">
                <Plus className="w-3.5 h-3.5 mr-2" /> Ajouter une séquence
              </Button>

              <div className="pt-6 border-t border-border/50">
                <Button type="submit" disabled={isUploading} className="w-full font-headline font-bold uppercase text-xs h-14 bg-primary shadow-xl">
                  {isUploading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                  Forger l'actif industriel
                </Button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
