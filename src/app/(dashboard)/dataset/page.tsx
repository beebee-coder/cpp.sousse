
"use client";

import { useState, useEffect, useCallback } from 'react';
import { 
  Database, 
  UploadCloud, 
  Layers,
  Mic,
  Loader2,
  Trash2,
  Wand2,
  Activity,
  ShieldCheck,
  Power,
  RotateCcw,
  FileText,
  HelpCircle
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
  
  const [isVoiceModeActive, setIsVoiceModeActive] = useState(false);
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);

  // Buffers pour la gestion phrase par phrase
  const [buffers, setBuffers] = useState<{ [key: string]: string[] }>({
    qaTitle: [],
    question: [],
    answer: []
  });

  const [qaTitle, setQaTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  useEffect(() => { setMounted(true); }, []);

  // Synchronisation des champs avec les buffers de phrases
  useEffect(() => {
    setQaTitle(buffers.qaTitle.join(' '));
    setQuestion(buffers.question.join('. ') + (buffers.question.length > 0 ? '.' : ''));
    setAnswer(buffers.answer.join('. ') + (buffers.answer.length > 0 ? '.' : ''));
  }, [buffers]);

  const handleVoiceResult = useCallback((text: string) => {
    if (!activeVoiceField) return;

    const lowerText = text.toLowerCase().trim();

    // LOGIQUE DE CORRECTION "NON"
    if (lowerText === 'non' || lowerText === 'non.') {
      setBuffers(prev => {
        const currentBuffer = prev[activeVoiceField];
        if (currentBuffer.length === 0) return prev;
        
        const newBuffer = [...currentBuffer];
        newBuffer.pop(); // Supprimer la dernière phrase
        
        voice.speak("Dernière phrase annulée.");
        return { ...prev, [activeVoiceField]: newBuffer };
      });
      return;
    }

    // Ajout de la phrase au buffer si elle n'est pas un doublon immédiat
    setBuffers(prev => {
      const currentBuffer = prev[activeVoiceField];
      if (currentBuffer[currentBuffer.length - 1] === text) return prev;
      return {
        ...prev,
        [activeVoiceField]: [...currentBuffer, text]
      };
    });
  }, [activeVoiceField]);

  const voice = useVoice({ onResult: handleVoiceResult });

  const handleFieldFocus = (field: string, prompt: string) => {
    if (!isVoiceModeActive) return;
    voice.stopListening();
    setActiveVoiceField(field);
    voice.speak(prompt);
    setTimeout(() => { voice.startListening(); }, 1200);
  };

  const toggleGlobalVoice = () => {
    const newState = !isVoiceModeActive;
    setIsVoiceModeActive(newState);
    if (newState) {
      voice.speak("Assistant vocal actif. Choisissez un champ.");
      toast({ title: "Assistant Vocal Actif", description: "Dites 'NON' pour corriger la dernière phrase." });
    } else {
      voice.stopListening();
      voice.speak("Assistant désactivé.");
      setActiveVoiceField(null);
    }
  };

  const handleRefine = async () => {
    if (!question.trim() && !answer.trim()) return;
    setIsRefining(true);
    try {
      const res = await apiClient.post<any>('/api/chat', {
        message: `Reformule ce signalement industriel de manière technique et concise. 
        Type: ${mode.toUpperCase()}
        Symptôme/Question: ${question}
        Action/Réponse: ${answer}
        Réponds STRICTEMENT au format JSON : {"question": "...", "answer": "..."}`,
        history: []
      });
      
      if (res && res.text) {
        try {
          const refined = JSON.parse(res.text);
          setBuffers(prev => ({
            ...prev,
            question: refined.question ? [refined.question] : prev.question,
            answer: refined.answer ? [refined.answer] : prev.answer
          }));
          toast({ title: "Optimisation Neurale Terminée" });
        } catch (parseError) {
          throw new Error("Format de réponse IA invalide.");
        }
      }
    } catch (e: any) {
      toast({ title: "Échec du raffinement", description: e.message, variant: "destructive" });
    } finally {
      setIsRefining(false);
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    
    const newItem: QAItem = {
      id: `rag-${Date.now()}`,
      type: mode,
      title: qaTitle.trim() || `${mode.toUpperCase()}_${Date.now()}`,
      label: question,
      details: answer,
      isRefined: true
    };
    
    setQaItems(prev => [newItem, ...prev]);
    setBuffers({ qaTitle: [], question: [], answer: [] });
    toast({ title: "Entrée ajoutée au registre local" });
    
    if (isVoiceModeActive) {
      voice.speak("Enregistré. Prêt pour la suite.");
      setActiveVoiceField(null);
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
            <Button 
              variant={isVoiceModeActive ? "default" : "outline"}
              size="sm"
              onClick={toggleGlobalVoice}
              className={cn(
                "h-9 text-[10px] uppercase font-bold transition-all gap-2",
                isVoiceModeActive ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(50,181,212,0.4)] animate-pulse" : "border-primary/20 text-muted-foreground"
              )}
            >
              <Power className="w-3.5 h-3.5" />
              {isVoiceModeActive ? "Assistant Actif" : "Activer Voix"}
            </Button>
            
            <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
              <button 
                onClick={() => setMode('qa')} 
                className={cn("px-4 py-1 text-[9px] uppercase rounded-sm flex items-center gap-2", mode === 'qa' ? "bg-primary text-primary-foreground font-bold shadow-lg" : "text-muted-foreground")}
              >
                <HelpCircle className="w-3 h-3" /> FAQ
              </button>
              <button 
                onClick={() => setMode('procedure')} 
                className={cn("px-4 py-1 text-[9px] uppercase rounded-sm flex items-center gap-2", mode === 'procedure' ? "bg-secondary text-secondary-foreground font-bold shadow-lg" : "text-muted-foreground")}
              >
                <FileText className="w-3 h-3" /> Procédure
              </button>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-5xl mx-auto w-full space-y-8">
          <Card className={cn(
            "p-6 border-border bg-card/50 space-y-6 shadow-2xl relative transition-all duration-500",
            isVoiceModeActive && "border-primary/40 ring-1 ring-primary/10"
          )}>
            {isVoiceModeActive && voice.isListening && (
              <div className="flex items-center justify-between px-3 py-2 bg-primary/10 border border-primary/30 rounded-sm animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">
                    ÉCOUTE : {activeVoiceField === 'qaTitle' ? 'ID' : activeVoiceField === 'question' ? 'DESCRIPTION' : 'RÉPONSE'}
                  </span>
                </div>
                <span className="text-[8px] font-code text-primary/60 uppercase animate-pulse">Dites "NON" pour corriger la phrase</span>
              </div>
            )}

            <form onSubmit={handleAddItem} className="space-y-6">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold uppercase text-primary mb-2 block tracking-widest">Identifiant de l'entrée</label>
                  <div className="flex gap-2">
                    <Input 
                      value={qaTitle} 
                      onChange={e => setQaTitle(e.target.value)}
                      onFocus={() => handleFieldFocus('qaTitle', "Veuillez donner un titre à l'entrée.")}
                      placeholder="EX: PANNE_POMPE_H02"
                      className={cn(
                        "bg-black/40 font-code uppercase h-12",
                        activeVoiceField === 'qaTitle' ? "border-primary ring-2 ring-primary/20" : "border-primary/20"
                      )}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => setBuffers(b => ({ ...b, qaTitle: [] }))} className="h-12 w-12 border-border/50"><RotateCcw className="w-4 h-4" /></Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground mb-2 block tracking-widest flex items-center justify-between">
                      {mode === 'qa' ? 'Question / Symptôme' : 'Description de la Situation'}
                      <Mic className={cn("w-3.5 h-3.5", voice.isListening && activeVoiceField === 'question' ? "text-primary animate-pulse" : "opacity-30")} />
                    </label>
                    <Textarea 
                      value={question}
                      readOnly
                      onFocus={() => handleFieldFocus('question', "Décrivez le symptôme ou la situation.")}
                      placeholder="Dictée vocale active..."
                      className={cn(
                        "h-48 bg-black/40 font-code text-xs resize-none transition-all",
                        activeVoiceField === 'question' ? "border-primary ring-2 ring-primary/20" : "border-border/50"
                      )}
                    />
                    <div className="flex justify-between items-center text-[9px]">
                       <span className="text-muted-foreground uppercase">{buffers.question.length} PHRASES</span>
                       <button type="button" onClick={() => setBuffers(b => ({ ...b, question: [] }))} className="uppercase font-bold text-muted-foreground hover:text-primary">Effacer</button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground mb-2 block tracking-widest flex items-center justify-between">
                      {mode === 'qa' ? 'Réponse Technique' : 'Procédure Corrective'}
                      <Mic className={cn("w-3.5 h-3.5", voice.isListening && activeVoiceField === 'answer' ? "text-primary animate-pulse" : "opacity-30")} />
                    </label>
                    <Textarea 
                      value={answer}
                      readOnly
                      onFocus={() => handleFieldFocus('answer', "Dictez la réponse ou l'action corrective.")}
                      placeholder="Dictée vocale active..."
                      className={cn(
                        "h-48 bg-black/40 font-code text-xs resize-none transition-all",
                        activeVoiceField === 'answer' ? "border-primary ring-2 ring-primary/20" : "border-border/50"
                      )}
                    />
                    <div className="flex justify-between items-center text-[9px]">
                       <span className="text-muted-foreground uppercase">{buffers.answer.length} PHRASES</span>
                       <button type="button" onClick={() => setBuffers(b => ({ ...b, answer: [] }))} className="uppercase font-bold text-muted-foreground hover:text-secondary">Effacer</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-border/30">
                <Button 
                  type="button" 
                  onClick={handleRefine} 
                  disabled={isRefining || (!question && !answer)}
                  variant="outline"
                  className="flex-1 h-12 border-primary/40 text-primary hover:bg-primary/5 font-bold uppercase text-xs"
                >
                  {isRefining ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                  Raffinement Neural
                </Button>
                <Button 
                  type="submit" 
                  disabled={!question || !answer}
                  className="flex-[2] h-12 bg-primary text-primary-foreground font-bold uppercase text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50"
                >
                  Valider dans le Registre
                </Button>
              </div>
            </form>
          </Card>

          {qaItems.length > 0 && (
            <div className="space-y-4 pb-12">
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <div className="flex items-center gap-3">
                  <Layers className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Registre Provisoire ({qaItems.length})</h3>
                </div>
                <Button 
                  onClick={async () => {
                    setIsUploading(true);
                    try {
                      const items = qaItems.map(it => ({
                        id: it.id,
                        projectId: 'project-001',
                        type: 'document',
                        content: JSON.stringify({ label: it.label, details: it.details, title: it.title, source: 'intelligent_voice_input' }),
                        tags: [it.type, 'neural_processed'],
                        createdAt: new Date().toISOString()
                      }));
                      await apiClient.post('/api/sync/upload', { userId: 'admin', projectId: 'project-001', items });
                      toast({ title: "Synchronisation réussie" });
                      setQaItems([]);
                    } catch (e) { toast({ title: "Erreur Sync", variant: "destructive" }); }
                    finally { setIsUploading(false); }
                  }} 
                  disabled={isUploading}
                  className="bg-secondary text-secondary-foreground font-bold uppercase text-[10px] h-9"
                >
                  {isUploading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <UploadCloud className="w-3 h-3 mr-2" />}
                  Synchronisation Physique
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {qaItems.map(item => (
                  <Card key={item.id} className={cn(
                    "p-4 border-border bg-card/20 relative group hover:border-primary/40 transition-all border-l-4",
                    item.type === 'procedure' ? "border-l-secondary/50" : "border-l-primary/50"
                  )}>
                    <button 
                      onClick={() => setQaItems(prev => prev.filter(i => i.id !== item.id))}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className={cn("w-3.5 h-3.5", item.type === 'procedure' ? "text-secondary" : "text-primary")} />
                      <span className="text-[10px] font-bold uppercase truncate pr-6">{item.title}</span>
                      <span className="text-[7px] px-1.5 py-0.5 bg-background border border-border rounded-sm text-muted-foreground uppercase">{item.type}</span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-code text-white bg-black/40 p-2 rounded-sm italic">"{item.label}"</p>
                      <p className="text-[9px] font-code text-muted-foreground px-2 border-l border-border/50 leading-relaxed">{item.details}</p>
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
