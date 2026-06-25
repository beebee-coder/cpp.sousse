
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Database, 
  Plus, 
  UploadCloud, 
  Layers,
  Mic,
  MicOff,
  Loader2,
  Trash2,
  Camera,
  Video as VideoIcon,
  FileText,
  Wand2,
  Volume2,
  Activity,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Power
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
  
  // Voice Mode Master State
  const [isVoiceModeActive, setIsVoiceModeActive] = useState(false);
  
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
      if (isVoiceModeActive) voice.speak("Optimisation terminée. Données prêtes pour enregistrement.");
    } catch (e) {
      toast({ title: "Échec du raffinement", variant: "destructive" });
    } finally {
      setIsRefining(false);
    }
  };

  const handleVoiceResult = useCallback((text: string) => {
    if (activeVoiceField === 'qaTitle') setQaTitle(prev => (prev + " " + text).trim());
    if (activeVoiceField === 'question') setQuestion(prev => (prev + " " + text).trim());
    if (activeVoiceField === 'answer') setAnswer(prev => (prev + " " + text).trim());
  }, [activeVoiceField]);

  const voice = useVoice({ onResult: handleVoiceResult });

  // Intelligent Guided Interaction on Focus
  const handleFieldFocus = (field: string, prompt: string) => {
    if (!isVoiceModeActive) return;
    
    // Stop current listening to refresh for the new field
    voice.stopListening();
    setActiveVoiceField(field);
    
    // Speak guidance
    voice.speak(prompt);
    
    // Start listening after a small delay to avoid capturing the prompt
    setTimeout(() => {
      voice.startListening();
    }, 1000);
  };

  const toggleGlobalVoice = () => {
    const newState = !isVoiceModeActive;
    setIsVoiceModeActive(newState);
    if (newState) {
      voice.speak("Assistant vocal activé. Sélectionnez un champ pour commencer la dictée.");
      toast({ title: "Mode IV Activé", description: "L'IA vous guidera lors du remplissage." });
    } else {
      voice.stopListening();
      voice.speak("Assistant vocal désactivé.");
      setActiveVoiceField(null);
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
    
    if (isVoiceModeActive) {
      voice.speak("Entrée enregistrée dans le registre provisoire.");
      setActiveVoiceField(null);
    }
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
      if (isVoiceModeActive) voice.speak("Synchronisation physique terminée avec succès.");
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
              {isVoiceModeActive ? "Assistant Vocal Actif" : "Activer Assistant Vocal"}
            </Button>
            
            <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
              <button onClick={() => setMode('qa')} className={cn("px-3 py-1 text-[9px] uppercase rounded-sm", mode === 'qa' ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground")}>Dictée FAQ</button>
              <button onClick={() => setMode('procedure')} className={cn("px-3 py-1 text-[9px] uppercase rounded-sm", mode === 'procedure' ? "bg-secondary text-secondary-foreground font-bold" : "text-muted-foreground")}>Dictée Procédure</button>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-5xl mx-auto w-full space-y-8">
          {/* Main Input Card */}
          <Card className={cn(
            "p-6 border-border bg-card/50 space-y-6 shadow-2xl relative overflow-hidden transition-all duration-500",
            isVoiceModeActive && "border-primary/40 ring-1 ring-primary/10"
          )}>
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Mic className="w-32 h-32" />
            </div>

            {isVoiceModeActive && voice.isListening && (
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-sm animate-in fade-in slide-in-from-top-2">
                <Activity className="w-4 h-4 text-primary animate-pulse" />
                <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">
                  Écoute active : {activeVoiceField === 'qaTitle' ? 'IDENTIFIANT' : activeVoiceField === 'question' ? 'SYMPTÔME' : 'ACTION'}
                </span>
              </div>
            )}

            <form onSubmit={handleAddItem} className="space-y-6 relative z-10">
              <div className="grid grid-cols-1 gap-6">
                {/* Identification Field */}
                <div className="relative">
                  <label className="text-[10px] font-bold uppercase text-primary mb-2 block tracking-widest">Identifiant de Référence</label>
                  <div className="flex gap-2">
                    <Input 
                      value={qaTitle} 
                      onChange={e => setQaTitle(e.target.value)}
                      onFocus={() => handleFieldFocus('qaTitle', "Veuillez dicter l'identifiant de référence.")}
                      placeholder="EX: PANNE_HYDRAULIQUE_H01"
                      className={cn(
                        "bg-black/40 font-code uppercase h-12 transition-all",
                        activeVoiceField === 'qaTitle' ? "border-primary ring-2 ring-primary/20" : "border-primary/20"
                      )}
                    />
                    <Button 
                      type="button" 
                      variant={activeVoiceField === 'qaTitle' ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => { setActiveVoiceField('qaTitle'); voice.startListening(); }}
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
                      <Mic className={cn("w-3.5 h-3.5", voice.isListening && activeVoiceField === 'question' ? "text-primary animate-pulse" : "opacity-30")} />
                    </label>
                    <Textarea 
                      value={question}
                      onChange={e => setQuestion(e.target.value)}
                      onFocus={() => handleFieldFocus('question', "Veuillez décrire le symptôme ou l'anomalie constatée.")}
                      placeholder="Décrivez l'anomalie constatée..."
                      className={cn(
                        "h-40 bg-black/40 font-code text-xs resize-none transition-all",
                        activeVoiceField === 'question' ? "border-primary ring-2 ring-primary/20" : "border-border/50"
                      )}
                    />
                  </div>

                  {/* Answer Field */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground mb-2 block tracking-widest flex items-center justify-between">
                      Action Corrective
                      <Mic className={cn("w-3.5 h-3.5", voice.isListening && activeVoiceField === 'answer' ? "text-primary animate-pulse" : "opacity-30")} />
                    </label>
                    <Textarea 
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      onFocus={() => handleFieldFocus('answer', "Veuillez dicter l'action corrective appliquée.")}
                      placeholder="Décrivez la solution appliquée..."
                      className={cn(
                        "h-40 bg-black/40 font-code text-xs resize-none transition-all",
                        activeVoiceField === 'answer' ? "border-primary ring-2 ring-primary/20" : "border-border/50"
                      )}
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
                  disabled={!question || !answer}
                  className="flex-[2] h-12 bg-primary text-primary-foreground font-bold uppercase text-xs shadow-lg hover:scale-[1.01] transition-transform disabled:opacity-50"
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
