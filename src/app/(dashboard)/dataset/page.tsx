"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Database, 
  Plus, 
  Layers,
  Mic,
  MicOff,
  Sparkles,
  Loader2,
  Trash2,
  ChevronDown,
  Info,
  ShieldAlert,
  Image as ImageIcon,
  Video as VideoIcon,
  Camera,
  CheckCircle2,
  Volume2,
  Type,
  Clock,
  Settings2,
  AlertTriangle,
  Zap,
  ArrowRight
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
import { Badge } from '@/components/ui/badge';

// Interface locale pour la dictée fluide
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
  
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'qa' | 'procedure'>('procedure');
  const [isUploading, setIsUploading] = useState(false);
  const [isAssistantActive, setIsAssistantActive] = useState(false);
  
  // Tampon pour la dictée par phrase
  const [phraseBuffers, setPhraseBuffers] = useState<Record<string, string[]>>({});
  
  // Champs FAQ
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  
  // Champs Procédure
  const [procTitle, setProcTitle] = useState('');
  const [procSteps, setProcSteps] = useState<DictationStep[]>([
    { id: '1', title: '', duration: '60', description: '', conditions: '', alarms: '' }
  ]);

  const [activeUIField, setActiveUIField] = useState<{ type: string, index?: number } | null>(null);
  const activeVoiceFieldRef = useRef<{ type: string, index?: number } | null>(null);

  useEffect(() => {
    activeVoiceFieldRef.current = activeUIField;
  }, [activeUIField]);

  const getFieldKey = (type: string, index?: number) => index !== undefined ? `${type}-${index}` : type;

  const updateTextFromBuffer = useCallback((key: string, phrases: string[]) => {
    const fullText = phrases.join(' ');
    if (key === 'question') setQuestion(fullText);
    else if (key === 'answer') setAnswer(fullText);
    else if (key === 'procTitle') setProcTitle(fullText);
    else if (key.includes('-')) {
      const [type, idxStr] = key.split('-');
      const index = parseInt(idxStr);
      setProcSteps(prev => {
        const next = [...prev];
        if (!next[index]) return prev;
        const s = { ...next[index] };
        if (type === 'stepTitle') s.title = fullText;
        else if (type === 'stepDuration') s.duration = fullText;
        else if (type === 'stepDescription') s.description = fullText;
        else if (type === 'stepConditions') s.conditions = fullText;
        else if (type === 'stepAlarms') s.alarms = fullText;
        next[index] = s;
        return next;
      });
    }
  }, []);

  const handleVoiceResult = useCallback((text: string) => {
    const target = activeVoiceFieldRef.current;
    if (!target) return;

    const key = getFieldKey(target.type, target.index);
    const lowerText = text.toLowerCase().trim();

    // Commande spéciale pour supprimer la dernière phrase
    if (lowerText === 'non' || lowerText === 'effacer') {
      setPhraseBuffers(prev => {
        const current = prev[key] || [];
        if (current.length === 0) return prev;
        const next = current.slice(0, -1);
        updateTextFromBuffer(key, next);
        voice.speak("Correction prise en compte.");
        return { ...prev, [key]: next };
      });
      return;
    }

    setPhraseBuffers(prev => {
      const current = prev[key] || [];
      const next = [...current, text];
      updateTextFromBuffer(key, next);
      return { ...prev, [key]: next };
    });
  }, [updateTextFromBuffer]);

  const voice = useVoice({
    onResult: handleVoiceResult,
    autoRestart: true,
    lang: 'fr-FR'
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleAssistant = () => {
    if (isAssistantActive) {
      voice.stopListening();
      setIsAssistantActive(false);
      setActiveUIField(null);
      voice.speak("Station de dictée en veille.");
    } else {
      if (!voice.isSupported) {
        toast({ title: "Incompatible", description: "Reconnaissance vocale non supportée.", variant: "destructive" });
        return;
      }
      setIsAssistantActive(true);
      voice.startListening();
      voice.speak("Station active. Dites le titre de la procédure.");
      handleFieldFocus('procTitle');
    }
  };

  const handleFieldFocus = (type: string, index?: number) => {
    setActiveUIField({ type, index });
    if (!isAssistantActive) return;
    
    let instruction = "";
    if (type === 'question') instruction = "Dites le symptôme.";
    else if (type === 'answer') instruction = "Dites la résolution.";
    else if (type === 'procTitle') instruction = "Quel est le titre ?";
    else if (type === 'stepTitle') instruction = `Action pour la séquence ${index! + 1} ?`;
    else if (type === 'stepDescription') instruction = "Détails techniques ?";

    if (instruction) voice.speak(instruction);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;

    if (mode === 'qa') {
      if (!question.trim() || !answer.trim()) {
        toast({ title: "Champs requis", description: "Symptôme et Résolution doivent être renseignés.", variant: "destructive" });
        return;
      }
      setIsUploading(true);
      try {
        const res = await fetch('/api/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'qa', title: question.slice(0, 50), question, answer }),
        });
        if (res.ok) {
          toast({ title: "Q/R enregistré et indexé" });
          setQuestion(''); setAnswer(''); setPhraseBuffers({});
        } else {
          throw new Error("Erreur de sauvegarde");
        }
      } catch {
        toast({ title: "Échec indexation", variant: "destructive" });
      } finally { setIsUploading(false); }
    } else {
      if (!procTitle.trim()) {
        toast({ title: "Titre requis", description: "La procédure doit avoir un titre.", variant: "destructive" });
        return;
      }
      setIsUploading(true);
      try {
        // Transformation vers le format industriel réel
        const formattedSteps = procSteps.map((s, i) => ({
          id: `step-${Date.now()}-${i}`,
          order: i + 1,
          title: s.title || `Séquence ${i + 1}`,
          description: s.description || "Instruction technique",
          duration: { 
            value: parseInt(s.duration) || 60, 
            unit: "seconds", 
            display: `${s.duration}s`, 
            type: "fixed" 
          },
          action: { 
            type: "confirmation", 
            instruction: s.description || "Confirmez l'exécution", 
            ui: { component: "action_button", label: "Confirmer", icon: "check" } 
          },
          validation: {
            conditions: s.conditions ? [{ 
              id: `val-${i}`, 
              description: s.conditions, 
              type: "status", 
              operator: "==", 
              value: "OK", 
              displayName: "Validation" 
            }] : [],
            successExpression: "status == OK",
            timeout: { value: 300, unit: "seconds", action: "warn" }
          },
          alarms: s.alarms ? [{
            id: `alarm-${i}`,
            code: "DICTATED_ALERT",
            type: "WARNING",
            severity: "HIGH",
            description: s.alarms,
            condition: "error_detected == true",
            remedy: {
              title: "Action Corrective",
              description: "Suivez le protocole de sécurité standard.",
              steps: ["Identifier l'anomalie", "Sécuriser la zone", "Signaler au superviseur"],
              estimatedTime: 120
            }
          }] : [],
          dependencies: { prerequisites: [], dependsOn: [], requiresConfirmation: true }
        }));

        const res = await fetch('/api/procedures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            title: procTitle, 
            steps: formattedSteps,
            metadata: { 
              category: "MAINTENANCE", 
              department: "PRODUCTION", 
              criticality: "MEDIUM", 
              version: "1.0.0" 
            }
          }),
        });

        const data = await res.json();
        if (data.success) {
          toast({ title: "Procédure forgée", description: "L'actif est prêt et indexé dans le registre." });
          setProcTitle('');
          setProcSteps([{ id: '1', title: '', duration: '60', description: '', conditions: '', alarms: '' }]);
          setPhraseBuffers({});
          if (isAssistantActive) voice.speak("Procédure enregistrée avec succès.");
        } else {
          throw new Error(data.message || "Erreur serveur");
        }
      } catch (err: any) {
        toast({ title: "Échec de la forge", description: err.message, variant: "destructive" });
      } finally { setIsUploading(false); }
    }
  };

  const removeStep = (index: number) => {
    if (procSteps.length <= 1) return;
    const next = [...procSteps];
    next.splice(index, 1);
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
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Station de Dictée Industrielle</span>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={toggleAssistant} 
              className={cn(
                "h-9 text-[9px] font-code uppercase transition-all shadow-lg", 
                isAssistantActive ? "bg-primary/20 border-primary text-primary animate-pulse" : "text-muted-foreground"
              )}
            >
              {isAssistantActive ? <Sparkles className="w-3.5 h-3.5 mr-2" /> : <Mic className="w-3.5 h-3.5 mr-2" />}
              Assistant {isAssistantActive ? "ACTIF" : "VEILLE"}
            </Button>
            <div className="flex bg-muted/30 p-1 rounded-sm border border-border shadow-inner">
              <button onClick={() => setMode('qa')} className={cn("px-4 py-1 text-[9px] uppercase rounded-sm font-bold transition-all", mode === 'qa' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground")}>FAQ</button>
              <button onClick={() => setMode('procedure')} className={cn("px-4 py-1 text-[9px] uppercase rounded-sm font-bold transition-all", mode === 'procedure' ? "bg-secondary text-secondary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground")}>Procédure</button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto terminal-scroll p-4 lg:p-8">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Infos Bloc */}
            <Card className="p-4 bg-primary/5 border border-primary/20 flex items-center gap-4">
               <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                 <Zap className="w-5 h-5 text-primary" />
               </div>
               <div>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Génération Directe</p>
                  <p className="text-[9px] font-code text-muted-foreground uppercase leading-tight">
                    Toute entrée validée est automatiquement vectorisée pour l'IA et archivée dans le registre physique <span className="text-white font-bold">.registry/procedures/</span>.
                  </p>
               </div>
            </Card>

            <Card className="p-6 lg:p-8 border-border bg-card/40 shadow-2xl relative">
              <form onSubmit={handleAddItem} className="space-y-8">
                {mode === 'qa' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-[8px] font-bold border-primary/30 text-primary">SYMPTÔME</Badge>
                      </div>
                      <Textarea 
                        value={question} 
                        onChange={(e) => setQuestion(e.target.value)} 
                        onFocus={() => handleFieldFocus('question')} 
                        placeholder="DÉTAILLEZ L'ANOMALIE OU LA QUESTION..." 
                        className={cn(
                          "h-48 bg-black/40 font-code text-xs uppercase border-border focus:border-primary transition-all", 
                          activeUIField?.type === 'question' && "ring-1 ring-primary"
                        )} 
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-[8px] font-bold border-secondary/30 text-secondary">RÉSOLUTION</Badge>
                      </div>
                      <Textarea 
                        value={answer} 
                        onChange={(e) => setAnswer(e.target.value)} 
                        onFocus={() => handleFieldFocus('answer')} 
                        placeholder="DÉTAILLEZ LA PROCÉDURE DE RÉSOLUTION..." 
                        className={cn(
                          "h-48 bg-black/40 font-code text-xs uppercase border-border focus:border-secondary transition-all", 
                          activeUIField?.type === 'answer' && "ring-1 ring-secondary"
                        )} 
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-10">
                    {/* Header Procédure */}
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-primary uppercase tracking-widest block">Titre de la procédure industrielle</label>
                      <div className="relative">
                        <Input 
                          value={procTitle} 
                          onChange={(e) => setProcTitle(e.target.value)} 
                          onFocus={() => handleFieldFocus('procTitle')} 
                          placeholder="EX: DÉMARRAGE POMPE CENTRIFUGE CRF-101..." 
                          className={cn(
                            "bg-black/60 uppercase h-14 text-sm font-bold border-primary/30 focus:border-primary tracking-tight transition-all", 
                            activeUIField?.type === 'procTitle' && "ring-1 ring-primary"
                          )} 
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20">
                          <Type className="w-5 h-5" />
                        </div>
                      </div>
                    </div>

                    {/* Liste des Séquences */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                         <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                           <Layers className="w-4 h-4 text-secondary" />
                           Séquençage Opérationnel
                         </h3>
                         <Badge variant="secondary" className="text-[9px] uppercase">{procSteps.length} Étapes</Badge>
                      </div>

                      {procSteps.map((step, index) => (
                        <Card key={index} className="p-6 border-border bg-black/30 space-y-6 group transition-all hover:border-primary/20">
                          <div className="flex justify-between items-center border-b border-border/50 pb-3">
                            <div className="flex items-center gap-3">
                               <div className="w-6 h-6 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center text-[10px] font-bold text-secondary">
                                 {index + 1}
                               </div>
                               <span className="text-[10px] font-bold text-white uppercase tracking-wider">Séquence Technique</span>
                            </div>
                            <div className="flex items-center gap-4">
                               <div className="flex items-center gap-2 bg-muted/20 px-2 py-1 rounded-sm border border-border">
                                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                  <Input 
                                    value={step.duration} 
                                    onChange={(e) => { const n = [...procSteps]; n[index].duration = e.target.value; setProcSteps(n); }} 
                                    className="h-6 w-14 text-[10px] font-code text-center bg-transparent border-none p-0 focus-visible:ring-0" 
                                  />
                                  <span className="text-[9px] font-code text-muted-foreground uppercase">sec</span>
                               </div>
                               <Button variant="ghost" size="icon" onClick={() => removeStep(index)} className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Trash2 className="w-3.5 h-3.5" />
                               </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div className="space-y-1.5">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Intitulé de l'action</p>
                                <Input 
                                  placeholder="TITRE DE L'ÉTAPE..." 
                                  value={step.title} 
                                  onFocus={() => handleFieldFocus('stepTitle', index)} 
                                  onChange={(e) => { const n = [...procSteps]; n[index].title = e.target.value; setProcSteps(n); }} 
                                  className="h-10 text-[10px] uppercase font-bold bg-black/20" 
                                />
                              </div>
                              <div className="space-y-1.5">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Consigne technique</p>
                                <Textarea 
                                  placeholder="INSTRUCTIONS DÉTAILLÉES..." 
                                  value={step.description} 
                                  onFocus={() => handleFieldFocus('stepDescription', index)} 
                                  onChange={(e) => { const n = [...procSteps]; n[index].description = e.target.value; setProcSteps(n); }} 
                                  className="h-24 text-[10px] uppercase font-code bg-black/20 resize-none" 
                                />
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div className="space-y-1.5">
                                <p className="text-[9px] font-bold text-primary uppercase">Validation Requise</p>
                                <Input 
                                  placeholder="EX: PRESSION > 5 BARS..." 
                                  value={step.conditions} 
                                  onChange={(e) => { const n = [...procSteps]; n[index].conditions = e.target.value; setProcSteps(n); }} 
                                  className="h-10 text-[10px] uppercase font-code bg-primary/5 border-primary/20" 
                                />
                              </div>
                              <div className="space-y-1.5">
                                <p className="text-[9px] font-bold text-destructive uppercase">Alarmes & Risques</p>
                                <Input 
                                  placeholder="EX: SURCHAUFFE MOTEUR..." 
                                  value={step.alarms} 
                                  onChange={(e) => { const n = [...procSteps]; n[index].alarms = e.target.value; setProcSteps(n); }} 
                                  className="h-10 text-[10px] uppercase font-code bg-destructive/5 border-destructive/20" 
                                />
                              </div>
                              <div className="pt-2">
                                <p className="text-[8px] font-code text-muted-foreground uppercase flex items-center gap-2">
                                  <ShieldAlert className="w-3 h-3" />
                                  Vérification d'intégrité automatique active
                                </p>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>

                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setProcSteps([...procSteps, { id: Date.now().toString(), title: '', duration: '60', description: '', conditions: '', alarms: '' }])} 
                      className="w-full border-dashed border-border h-12 text-[10px] uppercase font-bold hover:bg-secondary/5 hover:border-secondary/40 transition-all"
                    >
                      <Plus className="w-4 h-4 mr-2 text-secondary" /> Ajouter une séquence opérationnelle
                    </Button>
                  </div>
                )}

                {/* Submit Section */}
                <div className="pt-10 border-t border-border/50">
                  <Button 
                    type="submit" 
                    disabled={isUploading} 
                    className={cn(
                      "w-full font-headline font-bold uppercase text-xs h-16 shadow-2xl transition-all active:scale-[0.99]", 
                      mode === 'qa' ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground shadow-[0_0_30px_rgba(46,184,146,0.2)]"
                    )}
                  >
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 animate-spin mr-3" />
                    ) : (
                      <CheckCircle2 className="w-6 h-6 mr-3" />
                    )}
                    {mode === 'qa' ? "Enregistrer dans la file sémantique" : "Forger la Procédure et Indexer"}
                  </Button>
                  
                  <div className="mt-4 flex items-center justify-center gap-6">
                     <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-secondary" />
                        <span className="text-[8px] font-bold text-muted-foreground uppercase">Indexation Chroma</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span className="text-[8px] font-bold text-muted-foreground uppercase">Archivage Registre</span>
                     </div>
                  </div>
                </div>
              </form>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
