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
  
  // --- STATE PROCÉDURE ---
  const [procTitle, setProcTitle] = useState('');
  const [procCode, setProcCode] = useState('');
  const [category, setCategory] = useState('OPERATION');
  const [department, setDepartment] = useState('PRODUCTION');
  const [criticality, setCriticality] = useState('MEDIUM');
  const [procSteps, setProcSteps] = useState<ProcedureStep[]>([]);

  // --- STATE Q/R ---
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

  // --- MOTEUR VOCAL ---
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
    
    setIsUploading(true);
    try {
      const res = await fetch('/api/procedures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: procTitle,
          metadata: { code: procCode, category, department, criticality },
          steps: procSteps
        }),
      });
      if (res.ok) {
        toast({ title: "PROCÉDURE FORGÉE" });
        router.push('/procedures');
      }
    } catch (err) {
      toast({ title: "ÉCHEC", variant: "destructive" });
    } finally { setIsUploading(false); }
  };

  const handleForgeQA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'qa', title: qaTitle, question: qaQuestion, answer: qaAnswer,
          tags: qaTags.split(',').map(t => t.trim()), category: qaCategory
        }),
      });
      if (res.ok) {
        toast({ title: "CONNAISSANCE INDEXÉE" });
        setQaTitle(''); setQaQuestion(''); setQaAnswer('');
      }
    } catch (err) {
      toast({ title: "ÉCHEC", variant: "destructive" });
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
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Station de Forge Industrielle</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto terminal-scroll p-4 lg:p-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-6xl mx-auto">
            <TabsList className="bg-muted/20 border border-border p-1 mb-8">
              <TabsTrigger value="procedure" className="px-8 text-[10px] font-bold uppercase">Séquençage Procédure</TabsTrigger>
              <TabsTrigger value="qa" className="px-8 text-[10px] font-bold uppercase">Base Q/R Sémantique</TabsTrigger>
            </TabsList>

            <TabsContent value="procedure">
              <form onSubmit={handleForgeProcedure} className="space-y-8 pb-24">
                <Card className="p-6 border-primary/20 bg-black/40 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-primary uppercase">Identification</label>
                      <Input value={procTitle} onChange={e => setProcTitle(e.target.value)} placeholder="TITRE PROCÉDURE" className="h-12 uppercase font-bold" />
                      <Input value={procCode} onChange={e => setProcCode(e.target.value)} placeholder="CODE" className="h-10 font-code" />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Audit</label>
                      <div className="grid grid-cols-2 gap-3">
                        <select value={criticality} onChange={e => setCriticality(e.target.value)} className="h-10 bg-black border rounded px-3 text-[10px] font-bold uppercase">
                          <option value="LOW">BASSE</option>
                          <option value="MEDIUM">MOYENNE</option>
                          <option value="HIGH">HAUTE</option>
                          <option value="CRITICAL">CRITIQUE</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </Card>

                {procSteps.map((step, index) => (
                  <Card key={step.id} className="p-6 border-border bg-black/20 space-y-4">
                    <div className="flex justify-between items-center">
                      <Badge variant="outline" className="text-[10px] font-bold uppercase">Séquence {index + 1}</Badge>
                      <Button type="button" variant="ghost" size="icon" onClick={() => { const n = [...procSteps]; n.splice(index, 1); setProcSteps(n); }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Input value={step.title} onChange={e => { const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n); }} placeholder="TITRE ACTION" className="uppercase font-bold" />
                        <div className="relative">
                          <Textarea value={step.description} onChange={e => { const n = [...procSteps]; n[index].description = e.target.value; setProcSteps(n); }} placeholder="Détails techniques..." className="h-24 text-xs font-code" />
                          <Button type="button" variant="ghost" size="sm" onClick={() => toggleDictation(`step-desc-${index}`)} className={cn("absolute bottom-2 right-2 h-7 text-[8px] uppercase", voice.isListening && activeVoiceField === `step-desc-${index}` ? "text-red-500 animate-pulse" : "text-primary")}><Mic className="w-3 h-3 mr-1" /> Dictée</Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                           <Button type="button" variant="outline" className="h-10 text-[9px] uppercase"><Camera className="w-4 h-4 mr-2" /> Image</Button>
                           <Button type="button" variant="outline" className="h-10 text-[9px] uppercase"><Video className="w-4 h-4 mr-2" /> Vidéo</Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
                <Button type="submit" disabled={isUploading} className="w-full h-16 bg-primary text-primary-foreground font-headline font-bold text-sm uppercase">
                  {isUploading ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <Save className="w-6 h-6 mr-3" />}
                  FORGER L'ACTIF INDUSTRIEL
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="qa">
              <form onSubmit={handleForgeQA} className="space-y-6 max-w-4xl mx-auto pb-24">
                <Card className="p-8 border-secondary/20 bg-black/40 space-y-6">
                  <div className="flex items-center gap-3 border-b border-border pb-4">
                    <BookOpen className="w-6 h-6 text-secondary" />
                    <div><h3 className="text-xl font-headline font-bold uppercase text-white">Item de Connaissance</h3></div>
                  </div>
                  <div className="space-y-4">
                    <Input value={qaTitle} onChange={e => setQaTitle(e.target.value)} placeholder="TITRE DE RÉFÉRENCE" className="h-12 bg-black/60 font-bold uppercase" />
                    <Input value={qaQuestion} onChange={e => setQaQuestion(e.target.value)} placeholder="QUESTION DU TECHNICIEN" className="h-12 bg-black/60 border-border" />
                    <div className="relative">
                      <Textarea value={qaAnswer} onChange={e => setQaAnswer(e.target.value)} placeholder="RÉPONSE DE L'AUDIT..." className="h-40 bg-black/60 border-border" />
                      <Button type="button" variant="ghost" size="sm" onClick={() => toggleDictation('qaAnswer')} className={cn("absolute bottom-2 right-2 h-7 text-[8px] uppercase", voice.isListening && activeVoiceField === 'qaAnswer' ? "text-red-500 animate-pulse" : "text-secondary")}><Mic className="w-3 h-3 mr-1" /> Dictée</Button>
                    </div>
                    <Input value={qaTags} onChange={e => setQaTags(e.target.value)} placeholder="tags (séparés par virgules)" className="h-10 bg-black/20 border-border font-code text-xs" />
                  </div>
                  <Button type="submit" disabled={isUploading} className="w-full h-16 bg-secondary text-secondary-foreground font-headline font-bold text-sm uppercase">
                    {isUploading ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <Zap className="w-6 h-6 mr-3" />}
                    INJECTER DANS LA MÉMOIRE RAG
                  </Button>
                </Card>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
