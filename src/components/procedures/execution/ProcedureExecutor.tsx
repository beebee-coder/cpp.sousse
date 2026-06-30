"use client";

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Play, 
  ShieldCheck,
  Zap,
  RotateCcw,
  Timer,
  Mic,
  MicOff,
  Sparkles,
  MessageSquare,
  FileText
} from 'lucide-react';
import { FullProcedure } from '@/lib/procedures/types';
import { ExecutionEngine, ExecutionState } from '@/lib/procedures/services/execution-engine.service';
import { StepGuide } from './StepGuide';
import { ProgressTracker } from './ProgressTracker';
import { useVoice } from '@/hooks/use-voice';
import { matchVoiceAction } from '@/lib/procedures/assistants/voice-commands';
import { procedureAssistant, AssistantAdvice } from '@/lib/procedures/assistants/procedure-assistant';
import { reportingService } from '@/lib/procedures/services/reporting.service';
import { cn } from '@/lib/utils';

interface ProcedureExecutorProps {
  procedure: FullProcedure;
}

export function ProcedureExecutor({ procedure }: ProcedureExecutorProps) {
  const [engine] = useState(() => new ExecutionEngine(procedure));
  const [state, setState] = useState<ExecutionState>(() => engine.getState());
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [advice, setAdvice] = useState<AssistantAdvice | null>(null);
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (state.status === 'RUNNING' || state.status === 'WAITING_CONFIRMATION') {
      setIsAssistantLoading(true);
      procedureAssistant.getStepAdvice(procedure, state).then(res => {
        setAdvice(res);
        setIsAssistantLoading(false);
      });
    }
  }, [state.currentStepIndex, state.status, procedure]);

  const handleStart = () => setState(engine.start());
  const handleConfirmPrerequisites = () => setState(engine.confirmPrerequisites());
  const handleNext = () => {
    const nextState = engine.nextStep();
    setState(nextState);
    if (nextState.status === 'COMPLETED') {
      const finalReport = reportingService.generateReport(procedure, nextState);
      setReport(finalReport);
    }
  };
  const handleTriggerAlarm = (code: string) => setState(engine.triggerAlarm(code));
  const handleResolveAlarm = (code: string) => setState(engine.resolveAlarm(code));

  const voice = useVoice({
    onResult: (text) => {
      const command = matchVoiceAction(text);
      if (command) {
        if (command.action === 'START' && state.status === 'IDLE') handleStart();
        if (command.action === 'NEXT') handleNext();
        if (command.action === 'ALARM') handleTriggerAlarm('VOICE_EMERGENCY');
      }
    },
    autoRestart: true,
    lang: 'fr-FR'
  });

  const currentStep = state.currentStepIndex >= 0 ? procedure.steps[state.currentStepIndex] : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
      <div className="lg:col-span-3 space-y-6">
        <Card className="p-4 border-primary/20 bg-black/40 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-3 h-3 rounded-full animate-pulse shadow-[0_0_10px_rgba(var(--primary),0.5)]",
              state.status === 'RUNNING' ? "bg-secondary" : 
              state.status === 'ALARM' ? "bg-destructive" : "bg-primary"
            )} />
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Contrôle de conformité</p>
              <h2 className="text-sm font-headline font-bold uppercase">{state.status.replace('_', ' ')}</h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => voice.isListening ? voice.stopListening() : voice.startListening()}
              className={cn(
                "h-9 px-4 text-[9px] font-bold uppercase transition-all",
                voice.isListening ? "bg-red-500/10 border-red-500 text-red-500 animate-pulse" : "border-border text-muted-foreground"
              )}
            >
              {voice.isListening ? <MicOff className="w-3.5 h-3.5 mr-2" /> : <Mic className="w-3.5 h-3.5 mr-2" />}
              {voice.isListening ? "ÉCOUTE ACTIVE" : "MICRO OFF"}
            </Button>
            
            <div className="h-10 w-px bg-border/50 mx-2" />
            
            <div className="text-right">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">T+ EXÉCUTION</p>
              <p className="text-sm font-code font-bold text-primary">
                {state.startTime ? Math.floor((currentTime - state.startTime) / 1000) : 0}s
              </p>
            </div>
          </div>
        </Card>

        <div className="min-h-[500px]">
          {state.status === 'IDLE' && (
            <Card className="h-full flex flex-col items-center justify-center p-12 text-center bg-card/20 border-dashed border-primary/30">
              <Zap className="w-16 h-16 text-primary mb-6 animate-pulse" />
              <h2 className="text-2xl font-headline font-bold uppercase mb-2">Prêt pour Initialisation</h2>
              <p className="text-muted-foreground font-code text-sm max-w-md mb-8 uppercase">
                Charge de la procédure "{procedure.title}" terminée. Moteur d'audit opérationnel.
              </p>
              <Button onClick={handleStart} size="lg" className="bg-primary text-primary-foreground font-bold uppercase px-12 h-12 shadow-2xl">
                <Play className="w-5 h-5 mr-2" /> Démarrer la séquence réelle
              </Button>
            </Card>
          )}

          {state.status === 'PREREQUISITES_CHECK' && (
            <Card className="p-8 border-primary/20 bg-card/40 space-y-6 shadow-2xl">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <ShieldCheck className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-headline font-bold uppercase">Audit des Prérequis réels</h3>
              </div>
              <div className="space-y-4">
                {procedure.prerequisites.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-black/20 rounded-sm border border-border">
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(46,184,146,0.5)]" />
                      <span className="text-sm font-code uppercase">{item.displayName}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-secondary/30 text-secondary uppercase font-bold">CONFORME</Badge>
                  </div>
                ))}
              </div>
              <div className="pt-6">
                <Button onClick={handleConfirmPrerequisites} className="w-full h-12 bg-secondary text-secondary-foreground font-bold uppercase shadow-xl">
                  Confirmer et Lancer l'Étape 1
                </Button>
              </div>
            </Card>
          )}

          {(state.status === 'RUNNING' || state.status === 'ALARM' || state.status === 'WAITING_CONFIRMATION') && currentStep && (
            <StepGuide 
              step={currentStep} 
              onNext={handleNext}
              onAlarm={handleTriggerAlarm}
              onResolve={handleResolveAlarm}
              isAlarm={state.status === 'ALARM'}
              startTime={state.stepStartTime || 0}
            />
          )}

          {state.status === 'COMPLETED' && (
            <Card className="h-full flex flex-col items-center justify-center p-12 text-center bg-secondary/5 border-secondary/20 shadow-2xl">
              <CheckCircle2 className="w-16 h-16 text-secondary mb-6" />
              <h2 className="text-2xl font-headline font-bold uppercase mb-2 text-secondary">Mission Validée</h2>
              <p className="text-muted-foreground font-code text-sm max-w-md mb-8 uppercase">
                Audit de conformité terminé. Rapport industriel généré pour archivage.
              </p>
              {report && (
                <div className="w-full max-w-lg mb-8 p-4 bg-black/40 border border-border rounded-sm text-left">
                  <div className="flex items-center gap-2 mb-3 text-secondary">
                    <FileText className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Audit Summary</span>
                  </div>
                  <pre className="text-[10px] font-code text-muted-foreground whitespace-pre-wrap">
                    {reportingService.toMarkdown(report)}
                  </pre>
                </div>
              )}
              <div className="flex gap-4">
                <Button variant="outline" onClick={() => window.location.reload()} className="h-10 text-[10px] uppercase font-bold px-8">
                  <RotateCcw className="w-4 h-4 mr-2" /> Réinitialiser
                </Button>
                <Button className="h-10 text-[10px] uppercase font-bold bg-primary text-primary-foreground px-8 shadow-xl">
                  Générer Certificat PDF
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <aside className="space-y-6 flex flex-col h-full">
        <ProgressTracker 
          steps={procedure.steps} 
          currentStepIndex={state.currentStepIndex}
          completedSteps={state.completedSteps}
        />

        <Card className="p-4 border-secondary/20 bg-secondary/5 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className={cn("w-4 h-4 text-secondary", isAssistantLoading && "animate-spin")} />
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-secondary">Copilote Industriel</h4>
            </div>
          </div>
          
          {advice ? (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
               <p className="text-[11px] font-code leading-relaxed text-white/90">
                 {advice.text}
               </p>
               {advice.relatedDocs && advice.relatedDocs.length > 0 && (
                 <div className="pt-2 space-y-2">
                   <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Référentiels RAG corrélés</p>
                   {advice.relatedDocs.map((doc, i) => (
                     <div key={i} className="p-2 bg-black/40 border border-border rounded-sm flex items-center justify-between group cursor-pointer hover:border-secondary/40 transition-colors">
                        <span className="text-[9px] font-code text-muted-foreground truncate">{doc.metadata?.title || "Manuel technique"}</span>
                        <MessageSquare className="w-3 h-3 text-secondary opacity-0 group-hover:opacity-100" />
                     </div>
                   ))}
                 </div>
               )}
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center opacity-30">
               <Sparkles className="w-8 h-8 mb-2" />
               <p className="text-[9px] font-code uppercase text-center">Traitement contextuel...</p>
            </div>
          )}
        </Card>

        <Card className="p-4 border-border bg-black/20 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Timer className="w-4 h-4 text-primary" />
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Registre Réel</h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-code">
              <span className="text-muted-foreground uppercase">RÉFÉRENCE</span>
              <span className="text-white font-bold">{procedure.code}</span>
            </div>
            <div className="flex justify-between text-[10px] font-code">
              <span className="text-muted-foreground uppercase">CRITICITÉ</span>
              <span className={cn(
                "font-bold",
                procedure.metadata.criticality === 'CRITICAL' ? "text-red-500" : "text-secondary"
              )}>{procedure.metadata.criticality}</span>
            </div>
          </div>
        </Card>
      </aside>
    </div>
  );
}
