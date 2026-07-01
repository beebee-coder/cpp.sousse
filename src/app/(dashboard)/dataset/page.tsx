"use client";

import { useState, useEffect } from 'react';
import { 
  Database, Plus, Loader2, Trash2, 
  Zap, CheckCircle2, Layers, ShieldAlert,
  Info, Camera, Video, AlertTriangle, Activity, Settings2,
  ListChecks, ShieldCheck, MessageSquare, BookOpen,
  Filter, Globe, Lock
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function DatasetPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('procedure');
  
  // --- STATE PROCÉDURE ---
  const [procTitle, setProcTitle] = useState('');
  const [procCode, setProcCode] = useState('');
  const [category, setCategory] = useState('OPERATION');
  const [department, setDepartment] = useState('PRODUCTION');
  const [criticality, setCriticality] = useState('MEDIUM');
  const [prereqItems, setPrereqItems] = useState<any[]>([]);
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

  // --- STATE Q/R ---
  const [qaTitle, setQaTitle] = useState('');
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');
  const [qaTags, setQaTags] = useState('');
  const [qaCategory, setQaCategory] = useState('Sécurité');
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  // Handler Forge Procédure
  const handleForgeProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;
    if (!procTitle.trim() || procSteps.some(s => !s.title.trim())) {
      toast({ title: "Données incomplètes", description: "Le titre et les étapes sont requis.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      const payload = {
        title: procTitle,
        category: category,
        prerequisites: { description: "Prerequis", items: prereqItems },
        steps: procSteps.map((s, i) => ({ ...s, order: i + 1 })),
        metadata: { title: procTitle, code: procCode, category, department, criticality }
      };
      const res = await fetch('/api/procedures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: "PROCÉDURE FORGÉE", description: data.message });
        router.push('/procedures');
      } else throw new Error(data.message || "REJET_BACKEND");
    } catch (err: any) {
      toast({ title: "ÉCHEC DE LA FORGE", description: err.message, variant: "destructive" });
    } finally { setIsUploading(false); }
  };

  // Handler Forge Q/R
  const handleForgeQA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;
    if (!qaTitle.trim() || !qaQuestion.trim() || !qaAnswer.trim()) {
      toast({ title: "Données incomplètes", description: "Tous les champs Q/R sont requis.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    console.log(`🧠 [FORGE_QR] Envoi vers la base de connaissances...`);
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
          isPublic
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: "CONNAISSANCE INDEXÉE", description: "L'item est prêt pour le RAG." });
        setQaTitle(''); setQaQuestion(''); setQaAnswer(''); setQaTags('');
      } else throw new Error(data.error || "ERREUR_INDEXATION");
    } catch (err: any) {
      toast({ title: "ÉCHEC Q/R", description: err.message, variant: "destructive" });
    } finally { setIsUploading(false); }
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
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Station de Forge Industrielle V6.6</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto terminal-scroll p-4 lg:p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-muted/20 border border-border p-1 mb-8">
                <TabsTrigger value="procedure" className="px-8 text-[10px] font-bold uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Layers className="w-3.5 h-3.5 mr-2" /> Forge Procédure
                </TabsTrigger>
                <TabsTrigger value="qa" className="px-8 text-[10px] font-bold uppercase data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
                  <MessageSquare className="w-3.5 h-3.5 mr-2" /> Base Q/R Sémantique
                </TabsTrigger>
              </TabsList>

              {/* CONTENU FORGE PROCÉDURE */}
              <TabsContent value="procedure">
                <form onSubmit={handleForgeProcedure} className="space-y-12 pb-24">
                  <Card className="p-8 border-primary/20 bg-black/40 space-y-8 shadow-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Actif Principal</label>
                        <Input value={procTitle} onChange={e => setProcTitle(e.target.value)} placeholder="TITRE DE LA PROCÉDURE" className="h-14 uppercase font-bold text-lg border-primary/30 bg-black/60" />
                        <div className="grid grid-cols-2 gap-4">
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
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Audit & Criticité</label>
                        <div className="grid grid-cols-2 gap-4">
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
                        <Textarea placeholder="Champ de description industrielle..." className="h-20 text-xs bg-black/20" />
                      </div>
                    </div>
                  </Card>

                  {/* Séquences */}
                  <div className="space-y-8">
                    {procSteps.map((step, index) => (
                      <Card key={step.id} className="p-8 border-border bg-black/40 space-y-8 relative group shadow-xl">
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-all" />
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <span className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary font-code">{index + 1}</span>
                            <Input value={step.title} onChange={e => { const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n); }} placeholder="TITRE SÉQUENCE" className="h-10 text-sm uppercase font-bold bg-transparent border-none p-0 focus-visible:ring-0 min-w-[300px]" />
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => { const n = [...procSteps]; n.splice(index, 1); setProcSteps(n); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-5 h-5" /></Button>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                          <div className="space-y-4">
                            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Instruction Opérateur</label>
                            <Textarea value={step.description} onChange={e => { const n = [...procSteps]; n[index].description = e.target.value; setProcSteps(n); }} placeholder="Détailler l'action technique..." className="h-32 text-xs font-code bg-black/20 resize-none border-border/50" />
                          </div>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                               <Button type="button" variant="outline" className="h-12 text-[9px] uppercase font-bold border-primary/20"><Camera className="w-4 h-4 mr-2" /> Image</Button>
                               <Button type="button" variant="outline" className="h-12 text-[9px] uppercase font-bold border-secondary/20"><Video className="w-4 h-4 mr-2" /> Vidéo</Button>
                            </div>
                            <div className="p-4 border border-red-900/30 bg-red-950/5 rounded-sm">
                               <p className="text-[8px] font-bold text-red-500 uppercase flex items-center gap-2"><AlertTriangle className="w-3 h-3" /> Protocoles Alarme</p>
                               <p className="text-[8px] text-muted-foreground/50 mt-1 italic uppercase">Configuration de sécurité optionnelle.</p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                    <Button type="button" variant="outline" onClick={() => setProcSteps([...procSteps, { id: `step-${Date.now()}`, title: '', description: '', action: { type: 'confirmation', ui: { label: 'CONFIRM' } }, validation: { conditions: [], timeout: { value: 300 } } }])} className="w-full border-dashed border-primary/20 h-20 text-[10px] uppercase font-bold hover:bg-primary/5 transition-all">
                      <Plus className="w-6 h-6 mr-3 text-primary" /> Ajouter Séquence au Registre
                    </Button>
                    <Button type="submit" disabled={isUploading} className="w-full h-20 bg-primary text-primary-foreground font-headline font-bold text-base uppercase shadow-2xl">
                      {isUploading ? <Loader2 className="w-8 h-8 animate-spin mr-4" /> : <ShieldCheck className="w-8 h-8 mr-4" />}
                      FORGER L'ACTIF INDUSTRIEL
                    </Button>
                  </div>
                </form>
              </TabsContent>

              {/* CONTENU FORGE Q/R */}
              <TabsContent value="qa">
                <form onSubmit={handleForgeQA} className="space-y-8 max-w-4xl mx-auto pb-24">
                  <Card className="p-8 border-secondary/20 bg-black/40 space-y-6 shadow-2xl">
                    <div className="flex items-center gap-3 border-b border-border pb-4 mb-4">
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
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Réponse de l'Audit</label>
                        <Textarea value={qaAnswer} onChange={e => setQaAnswer(e.target.value)} placeholder="Rédigez la réponse technique précise ici..." className="h-40 bg-black/60 border-border text-sm leading-relaxed" />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mots-clés (tags, séparés par virgules)</label>
                          <Input value={qaTags} onChange={e => setQaTags(e.target.value)} placeholder="crf, sécurité, vanne..." className="h-10 bg-black/20 border-border font-code text-xs" />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-muted/10 rounded-sm border border-border mt-6">
                           <div className="flex items-center gap-3">
                              {isPublic ? <Globe className="w-4 h-4 text-secondary" /> : <Lock className="w-4 h-4 text-primary" />}
                              <span className="text-[10px] font-bold uppercase">{isPublic ? "Accès Public Registre" : "Accès Privé Admin"}</span>
                           </div>
                           <button type="button" onClick={() => setIsPublic(!isPublic)} className={cn("w-12 h-6 rounded-full transition-all relative p-1", isPublic ? "bg-secondary" : "bg-muted")}>
                              <div className={cn("w-4 h-4 bg-white rounded-full transition-all", isPublic ? "translate-x-6" : "translate-x-0")} />
                           </button>
                        </div>
                      </div>
                    </div>

                    <div className="pt-8 border-t border-border/50">
                       <Button type="submit" disabled={isUploading} className="w-full h-16 bg-secondary text-secondary-foreground font-headline font-bold text-base uppercase shadow-xl hover:scale-[1.01] transition-transform">
                         {isUploading ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <Zap className="w-6 h-6 mr-3" />}
                         INJECTER DANS LA MÉMOIRE RAG
                       </Button>
                    </div>
                  </Card>

                  <div className="p-4 bg-secondary/5 border border-secondary/20 rounded-sm flex gap-4">
                     <Info className="w-5 h-5 text-secondary shrink-0" />
                     <p className="text-[10px] font-code text-muted-foreground uppercase leading-relaxed">
                       Chaque item injecté est instantanément vectorisé et devient accessible via le <span className="text-secondary font-bold">Chat Neural</span> pour l'ensemble des opérateurs accrédités.
                     </p>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
