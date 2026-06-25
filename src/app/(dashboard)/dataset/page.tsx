
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Database, 
  Plus, 
  UploadCloud, 
  Layers,
  Mic,
  Loader2,
  Trash2,
  Camera,
  Video as VideoIcon,
  FileText,
  Wand2,
  Volume2,
  Activity,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { useVoice } from '@/hooks/use-voice';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface QAItem {
  id: string;
  type: 'qa' | 'procedure';
  title: string;
  label: string;
  details: string;
  isRefined?: boolean;
}

export default function DatasetPage() {
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'qa' | 'procedure'>('qa');
  const [qaItems, setQaItems] = useState<QAItem[]>([]);
  
  // Form states
  const [qaTitle, setQaTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  
  const [isUploading, setIsUploading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Neural Refinement : Utilise Groq pour transformer la dictée brute en texte industriel pro
  const handleRefine = async () => {
    if (!question.trim() && !answer.trim()) return;
    setIsRefining(true);
    try {
      const res = await apiClient.post<any>('/api/chat', {
        message: `Reformule ce signalement industriel de manière technique et concise. 
        Symptôme: ${question}
        Action: ${answer}
        Réponds strictement au format JSON : {"question": "...", "answer": "..."}`,
        history: []
      });
      
      const refined = JSON.parse(res.text);
      if (refined.question) setQuestion(refined.question);
      if (refined.answer) setAnswer(refined.answer);
      
      toast({ title: "Optimisation Neurale Terminée" });
    } catch (e) {
      toast({ title: "Échec du raffinement", variant: "destructive" });
    } finally {
      setIsRefining(false);
    }
  };

  const handleVoiceResult = useCallback((text: string) => {
    if (activeVoiceField === 'qaTitle') setQaTitle(prev => prev + " " + text);
    if (activeVoiceField === 'question') setQuestion(prev => prev + " " + text);
    if (activeVoiceField === 'answer') setAnswer(prev => prev + " " + text);
  }, [activeVoiceField]);

  const voice = useVoice({ onResult: handleVoiceResult });

  const toggleVoice = (field: string) => {
    if (voice.isListening && activeVoiceField === field) {
      voice.stopListening();
      setActiveVoiceField(null);
    } else {
      setActiveVoiceField(field);
      voice.startListening();
      voice.speak(`Dictée active pour le champ ${field}.`);
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    
    const newItem: QAItem = {
      id: `qa-${Date.now()}`,
      type: 'qa',
      title: qaTitle.trim() || `RAG_${Date.now()}`,
      label: question,
      details: answer,
      isRefined: true
    };
    
    setQaItems(prev => [newItem, ...prev]);
    setQuestion(''); setAnswer(''); setQaTitle('');
    toast({ title: "Entrée ajoutée au registre local" });
  };

  const handleFinalSync = async () => {
    if (qaItems.length === 0) return;
    setIsUploading(true);
    try {
      const items = qaItems.map(it => ({
        id: it.id,
        projectId: 'project-001',
        type: 'document',
        content: JSON.stringify({ 
          label: it.label, 
          details: it.details, 
          title: it.title,
          source: 'intelligent_voice_input'
        }),
        tags: [it.type, 'neural_processed'],
        createdAt: new Date().toISOString()
      }));
      
      await apiClient.post('/api/sync/upload', { userId: 'admin', projectId: 'project-001', items });
      toast({ title: "Synchronisation physique réussie", description: `${items.length} documents indexés.` });
      setQaItems([]);
    } catch (e) {
      toast({ title: "Échec de synchronisation", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto terminal-scroll">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <Database className="w-4 h-4 text-primary" />
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Station de Dictée RAG</span>
          </div>
          <div className="flex items-center gap-4">
            {voice.isListening && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full animate-pulse">
                <Activity className="w-3 h-3 text-red-500" />
                <span className="text-[8px] font-bold text-red-500 uppercase">Signal Vocal Actif</span>
              </div>
            )}
            <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
              <button onClick={() => setMode('qa')} className={cn("px-3 py-1 text-[9px] uppercase rounded-sm", mode === 'qa' ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground")}>Dictée FAQ</button>
              <button onClick={() => setMode('procedure')} className={cn("px-3 py-1 text-[9px] uppercase rounded-sm", mode === 'procedure' ? "bg-secondary text-secondary-foreground font-bold" : "text-muted-foreground")}>Dictée Procédure</button>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-5xl mx-auto w-full space-y-8">
          {/* Main Input Card */}
          <Card className="p-6 border-border bg-card/50 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Mic className="w-32 h-32" />
            </div>

            <form onSubmit={handleAddItem} className="space-y-6 relative z-10">
              <div className="grid grid-cols-1 gap-6">
                {/* Identification Field */}
                <div className="relative">
                  <label className="text-[10px] font-bold uppercase text-primary mb-2 block tracking-widest">Identifiant de Référence</label>
                  <div className="flex gap-2">
                    <Input 
                      value={qaTitle} 
                      onChange={e => setQaTitle(e.target.value)}
                      placeholder="EX: PANNE_HYDRAULIQUE_H01"
                      className={cn("bg-black/40 font-code uppercase h-12 border-primary/20", activeVoiceField === 'qaTitle' && "ring-2 ring-primary")}
                    />
                    <Button 
                      type="button" 
                      variant={activeVoiceField === 'qaTitle' ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => toggleVoice('qaTitle')}
                      className="h-12 w-12 shrink-0"
                    >
                      <Mic className={cn("w-5 h-5", voice.isListening && activeVoiceField === 'qaTitle' && "animate-bounce")} />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Question Field */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground mb-2 block tracking-widest flex items-center justify-between">
                      Description du Symptôme
                      <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('question')} className="h-6 w-6"><Mic className="w-3 h-3" /></Button>
                    </label>
                    <Textarea 
                      value={question}
                      onChange={e => setQuestion(e.target.value)}
                      placeholder="Décrivez l'anomalie constatée..."
                      className={cn("h-40 bg-black/40 font-code text-xs border-border/50 resize-none", activeVoiceField === 'question' && "ring-2 ring-primary")}
                    />
                  </div>

                  {/* Answer Field */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground mb-2 block tracking-widest flex items-center justify-between">
                      Action Corrective
                      <Button type="button" variant="ghost" size="icon" onClick={() => toggleVoice('answer')} className="h-6 w-6"><Mic className="w-3 h-3" /></Button>
                    </label>
                    <Textarea 
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      placeholder="Décrivez la solution appliquée..."
                      className={cn("h-40 bg-black/40 font-code text-xs border-border/50 resize-none", activeVoiceField === 'answer' && "ring-2 ring-primary")}
                    />
                  </div>
                </div>
              </div>

              {/* Interaction Bar */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-border/30">
                <Button 
                  type="button" 
                  onClick={handleRefine} 
                  disabled={isRefining || (!question && !answer)}
                  variant="outline"
                  className="flex-1 h-12 border-primary/40 text-primary hover:bg-primary/5 font-bold uppercase text-xs"
                >
                  {isRefining ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                  Raffinement Neural IA
                </Button>
                <Button 
                  type="submit" 
                  className="flex-[2] h-12 bg-primary text-primary-foreground font-bold uppercase text-xs shadow-lg hover:scale-[1.01] transition-transform"
                >
                  Ajouter au Registre Physique
                </Button>
              </div>
            </form>
          </Card>

          {/* Pending Items List */}
          {qaItems.length > 0 && (
            <div className="space-y-4 pb-12">
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <div className="flex items-center gap-3">
                  <Layers className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Registre Provisoire ({qaItems.length})</h3>
                </div>
                <Button 
                  onClick={handleFinalSync} 
                  disabled={isUploading}
                  className="bg-secondary text-secondary-foreground font-bold uppercase text-[10px] h-9"
                >
                  {isUploading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <UploadCloud className="w-3 h-3 mr-2" />}
                  Synchronisation Physique
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {qaItems.map(item => (
                  <Card key={item.id} className="p-4 border-border bg-card/20 relative group hover:border-primary/40 transition-all border-l-4 border-l-primary/50">
                    <button 
                      onClick={() => setQaItems(prev => prev.filter(i => i.id !== item.id))}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] font-bold text-primary uppercase truncate pr-6">{item.title}</span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-code text-white bg-black/40 p-2 rounded-sm italic">"{item.label}"</p>
                      <p className="text-[9px] font-code text-muted-foreground px-2 border-l border-border/50 leading-relaxed">{item.details}</p>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <span className="text-[7px] font-code uppercase text-primary/40">Neural Verified</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
