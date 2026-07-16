"use client";

import { useState, useEffect, useRef } from 'react';
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
import { useProcedureExecution } from '@/lib/procedures/hooks/useProcedureExecution';
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
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [advice, setAdvice] = useState<AssistantAdvice | null>(null);
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [currentPrerequisite, setCurrentPrerequisite] = useState<FullProcedure['prerequisites']['items'][number] | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const {
    status,
    currentStepIndex,
    currentStep,
    totalSteps,
    isRunning,
    isCompleted,
    isAlarm,
    confirmedPrerequisites,
    stepReport,
    alarm,
    start,
    nextStep,
    triggerAlarm,
    resolveAlarm,
    confirmPrerequisite,
    confirmAllPrerequisites,
  } = useProcedureExecution({
    procedure,
    onComplete: (execState) => {
      const finalReport = reportingService.generateReport(procedure, execState);
      console.log('[EXECUTOR] Rapport généré:', finalReport);
    },
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();

    if (status === 'RUNNING' || status === 'WAITING_CONFIRMATION') {
      debounceRef.current = setTimeout(() => {
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setIsAssistantLoading(true);
        procedureAssistant.getStepAdvice(procedure, {
          currentStepIndex,
          status,
          completedSteps: stepReport.filter(r => r.status === 'completed').map(r => r.stepId),
          activeAlarms: alarm || [],
          confirmedPrerequisites,
        } as any).then(res => {
          if (!controller.signal.aborted) {
            setAdvice(res);
            setIsAssistantLoading(false);
          }
        }).catch(() => {
          if (!controller.signal.aborted) {
            setIsAssistantLoading(false);
          }
        });
      }, 400);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [currentStepIndex, status, procedure, stepReport, alarm, confirmedPrerequisites]);

  const voice = useVoice({
    onResult: (text) => {
      const command = matchVoiceAction(text);
      if (command) {
        if (command.action === 'START' && status === 'IDLE') start();
        if (command.action === 'NEXT') nextStep();
        if (command.action === 'ALARM') triggerAlarm('VOICE_EMERGENCY');
        if (command.action === 'CONFIRM' && status === 'PREREQUISITES_CHECK') {
          if (currentPrerequisite) confirmPrerequisite(currentPrerequisite.id);
        }
      }
    },
    onActivate: () => {
      let guide = '';
      if (status === 'IDLE') {
        guide = `Procédure ${procedure.title} prête. Dites "démarrer" pour lancer la séquence.`;
        setTimeout(() => startButtonRef.current?.focus(), 100);
      } else if (status === 'PREREQUISITES_CHECK') {
        guide = currentPrerequisite
          ? `Prérequis en cours : ${currentPrerequisite.displayName}. Dites "confirmer" une fois vérifié.`
          : 'Tous les prérequis sont confirmés. Dites "confirmer" pour lancer.';
        setTimeout(() => confirmButtonRef.current?.focus(), 100);
      } else if (status === 'RUNNING' || status === 'WAITING_CONFIRMATION') {
        guide = `Étape ${currentStepIndex + 1} sur ${totalSteps} : ${displayCurrentStep?.title || 'en cours'}. Dites "suivant" pour passer à l étape suivante.`;
      } else if (status === 'ALARM') {
        guide = 'Anomalie détectée. Dites "anomalie" pour signaler, ou "suivant" pour continuer.';
      } else if (status === 'COMPLETED') {
        guide = 'Procédure terminée avec succès.';
      }
      if (guide) {
        setTimeout(() => voice.speak(guide), 400);
      }
    },
    autoRestart: true,
    lang: 'fr-FR'
  });

  useEffect(() => {
    if (status === 'PREREQUISITES_CHECK' && currentPrerequisite) {
      const utterance = new SpeechSynthesisUtterance(currentPrerequisite.manualCheckInstruction || `Prérequis : ${currentPrerequisite.displayName}. Veuillez confirmer.`);
      utterance.lang = 'fr-FR';
      utterance.rate = 1.0;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }, [currentPrerequisite, status]);

  const handleStart = () => {
    start();
    const prerequisites = procedure.prerequisites.items;
    if (prerequisites.length > 0) {
      setCurrentPrerequisite(prerequisites[0]);
    }
  };

  const handleConfirmPrerequisite = () => {
    if (!currentPrerequisite) return;
    const newConfirmed = confirmPrerequisite(currentPrerequisite.id);
    const remaining = procedure.prerequisites.items.filter(p => !newConfirmed.includes(p.id));
    if (remaining.length > 0) {
      setCurrentPrerequisite(remaining[0]);
    } else {
      setCurrentPrerequisite(null);
    }
  };

  const handleConfirmPrerequisites = () => {
    confirmAllPrerequisites();
    setCurrentPrerequisite(null);
  };

  const displayCurrentStep = currentStepIndex >= 0 ? procedure.steps[currentStepIndex] : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
      <div className="lg:col-span-3 space-y-6">
        <Card className="p-4 border-primary/20 bg-black/40 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-3 h-3 rounded-full animate-pulse shadow-[0_0_10px_rgba(var(--primary),0.5)]",
              status === 'RUNNING' ? "bg-secondary" : 
              status === 'ALARM' ? "bg-destructive" : "bg-primary"
            )} />
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Contrôle de conformité</p>
              <h2 className="text-sm font-headline font-bold uppercase">{status.replace('_', ' ')}</h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => voice.isListening ? voice.stopListening() : voice.startListening()}
              className={cn(
                "h-9 px-4 text-tiny font-bold uppercase transition-all",
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
                {status === 'IDLE' ? '0s' : `${Math.floor((currentTime - (currentStepIndex >= 0 ? currentTime - 1000 : currentTime)) / 1000)}s`}
              </p>
            </div>
          </div>
        </Card>

        <div className="min-h-[500px]">
          {status === 'IDLE' && (
            <Card className="h-full flex flex-col items-center justify-center p-12 text-center bg-card/20 border-dashed border-primary/30">
              <Zap className="w-16 h-16 text-primary mb-6 animate-pulse" />
              <h2 className="text-2xl font-headline font-bold uppercase mb-2">Prêt pour Initialisation</h2>
              <p className="text-muted-foreground font-code text-sm max-w-md mb-8 uppercase">
                Charge de la procédure "{procedure.title}" terminée. Moteur d'audit opérationnel.
              </p>
              <Button ref={startButtonRef} onClick={handleStart} size="lg" className="bg-primary text-primary-foreground font-bold uppercase px-12 h-12 shadow-2xl">
                <Play className="w-5 h-5 mr-2" /> Démarrer la séquence réelle
              </Button>
            </Card>
          )}

          {status === 'PREREQUISITES_CHECK' && (
            <Card className="p-8 border-primary/20 bg-card/40 space-y-6 shadow-2xl">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <ShieldCheck className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-headline font-bold uppercase">Confirmation manuelle des prérequis</h3>
              </div>
              
              {currentPrerequisite ? (
                <div className="space-y-6">
                  <div className="p-6 bg-black/40 border border-primary/30 rounded-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                        Étape {confirmedPrerequisites.length + 1} sur {procedure.prerequisites.items.length}
                      </span>
                    </div>
                    <h4 className="text-lg font-headline font-bold uppercase mb-2">{currentPrerequisite.displayName}</h4>
                    <p className="text-sm font-code text-muted-foreground mb-4">{currentPrerequisite.description}</p>
                    <div className="p-4 info-card">
                      <p className="text-xs font-code text-primary">
                        <span className="font-bold">Instruction : </span>
                        {currentPrerequisite.manualCheckInstruction}
                      </p>
                    </div>
                  </div>
                  
                   <div className="flex gap-4">
                     <Button 
                       ref={confirmButtonRef}
                       onClick={handleConfirmPrerequisite} 
                       className="flex-1 h-12 bg-secondary text-secondary-foreground font-bold uppercase shadow-xl"
                     >
                       <CheckCircle2 className="w-5 h-5 mr-2" />
                       Confirmer ce prérequis
                     </Button>
                   </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-secondary/10 border border-secondary/30 rounded-sm">
                    <p className="text-sm font-code text-secondary">Tous les prérequis ont été confirmés.</p>
                  </div>
                  <Button 
                    onClick={handleConfirmPrerequisites} 
                    className="w-full h-12 bg-secondary text-secondary-foreground font-bold uppercase shadow-xl"
                  >
                    Lancer la procédure
                  </Button>
                </div>
              )}
            </Card>
          )}

          {(status === 'RUNNING' || status === 'ALARM' || status === 'WAITING_CONFIRMATION') && displayCurrentStep && (
            <StepGuide 
              step={displayCurrentStep} 
              onNext={() => nextStep()}
              onAlarm={triggerAlarm}
              onResolve={resolveAlarm}
              isAlarm={status === 'ALARM'}
              startTime={Date.now()}
              voiceActive={voice.isListening}
            />
          )}

          {status === 'COMPLETED' && (
            <Card className="h-full flex flex-col items-center justify-center p-12 text-center panel-card shadow-2xl">
              <CheckCircle2 className="w-16 h-16 text-secondary mb-6" />
              <h2 className="text-2xl font-headline font-bold uppercase mb-2 text-secondary">Mission Validée</h2>
              <p className="text-muted-foreground font-code text-sm max-w-md mb-8 uppercase">
                Audit de conformité terminé. Rapport industriel généré pour archivage.
              </p>
              {stepReport.length > 0 && (
                <div className="w-full max-w-lg mb-8 p-4 terminal-card text-left">
                  <div className="flex items-center gap-2 mb-3 text-secondary">
                    <FileText className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Audit Summary</span>
                  </div>
                  <pre className="text-[10px] font-code text-muted-foreground whitespace-pre-wrap">
                    {reportingService.toMarkdown({
                      id: `report-${Date.now()}`,
                      procedureCode: procedure.code,
                      operatorId: 'admin_station',
                      startTime: new Date().toISOString(),
                      endTime: new Date().toISOString(),
                      duration: stepReport.reduce((sum: number, r: any) => sum + r.duration, 0),
                      stepsCompleted: stepReport.filter(r => r.status === 'completed').length,
                      totalSteps: procedure.steps.length,
                      alarmsTriggered: alarm || [],
                      status: 'COMPLETED',
                    })}
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
          currentStepIndex={currentStepIndex}
          completedSteps={stepReport.filter(r => r.status === 'completed').map(r => r.stepId)}
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
                    <p className="text-micro font-bold text-muted-foreground uppercase tracking-widest">Référentiels RAG corrélés</p>
                    {advice.relatedDocs.map((doc: any, i: number) => (
                      <div key={i} className="p-2 terminal-card flex items-center justify-between group cursor-pointer hover:border-secondary/40 transition-colors">
                         <span className="text-tiny font-code text-muted-foreground truncate">{doc.metadata?.title || "Manuel technique"}</span>
                         <MessageSquare className="w-3 h-3 text-secondary opacity-0 group-hover:opacity-100" />
                      </div>
                    ))}
                  </div>
                )}
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center opacity-30">
               <Sparkles className="w-8 h-8 mb-2" />
               <p className="text-tiny font-code uppercase text-center">Traitement contextuel...</p>
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
