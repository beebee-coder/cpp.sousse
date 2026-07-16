"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Info,
  ShieldCheck,
  Play,
  RotateCcw,
  CheckCircle2,
  Settings2,
  Volume2,
  VolumeX,
  Pause,
  SkipForward,
  ChevronDown,
  ChevronUp,
  Edit3,
  Image,
  Video,
  Save,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FullProcedure, ProcedureStep } from '@/lib/procedures/types';
import { useProcedureExecution } from '@/lib/procedures/hooks/useProcedureExecution';
import { procedureAssistant, AssistantAdvice } from '@/lib/procedures/assistants/procedure-assistant';
import { useTranslation } from '@/hooks/use-translation';
import { BriefingStage } from './BriefingStage';
import { PrerequisitesStage } from './PrerequisitesStage';
import { RunningStage } from './RunningStage';
import { CompletedStage } from './CompletedStage';
import { AbortedStage } from './AbortedStage';
import { AlarmModal } from './AlarmModal';
import { MediaEditor } from './MediaEditor';

interface ProcedureGuideProps {
  procedure: FullProcedure;
  onComplete?: (report: any) => void;
}

type GuidePhase = 'briefing' | 'active';

export function ProcedureGuide({ procedure, onComplete }: ProcedureGuideProps) {
  const [phase, setPhase] = useState<GuidePhase>('briefing');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [confirmedPrerequisites, setConfirmedPrerequisites] = useState<Set<string>>(new Set());
  const [autoChecking, setAutoChecking] = useState(false);
  const [checkResults, setCheckResults] = useState<Record<string, boolean>>({});
  const [showStepNavigator, setShowStepNavigator] = useState(false);
  const [mediaEditorOpen, setMediaEditorOpen] = useState(false);
  const [localProcedure, setLocalProcedure] = useState(procedure);
  const [advice, setAdvice] = useState<AssistantAdvice | null>(null);
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);

  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const adviceAbortRef = useRef<AbortController | null>(null);
  const t = useTranslation();

  const {
    status,
    currentStepIndex,
    currentStep,
    totalSteps,
    elapsed,
    isPaused,
    stepReport,
    alarm,
    confirmedPrerequisites: engineConfirmedPrerequisites,
    progress,
    isRunning,
    isCompleted,
    isFailed,
    isAborted,
    isAlarm,
    start,
    nextStep,
    previousStep,
    skipStep,
    repeatStep,
    togglePause,
    triggerAlarm,
    resolveAlarm,
    confirmPrerequisite,
    confirmAllPrerequisites,
    fail,
    restart,
    exportJson,
  } = useProcedureExecution({
    procedure,
    onComplete,
  });

  useEffect(() => {
    setLocalProcedure(procedure);
  }, [procedure]);

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Vérification automatique simulée des prérequis
  const checkPrerequisites = useCallback(async () => {
    setAutoChecking(true);
    const results: Record<string, boolean> = {};
    
    for (const prereq of procedure.prerequisites.items) {
      if (prereq.verificationType === 'automatic') {
        await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 800));
        const ok = Math.random() > 0.2;
        results[prereq.id] = ok;
      } else {
        results[prereq.id] = engineConfirmedPrerequisites.includes(prereq.id);
      }
    }
    
    setCheckResults(results);
    setAutoChecking(false);
    return results;
  }, [procedure.prerequisites.items, engineConfirmedPrerequisites]);

  // Vérifier les prérequis automatiques au montage
  useEffect(() => {
    if (phase === 'active' && status === 'PREREQUISITES_CHECK') {
      checkPrerequisites();
    }
  }, [phase, status]);

  const allPrerequisitesMet = () => {
    return procedure.prerequisites.items.every(prereq => {
      if (prereq.verificationType === 'automatic') {
        return checkResults[prereq.id] === true;
      }
      return engineConfirmedPrerequisites.includes(prereq.id);
    });
  };

  const unmetPrerequisites = procedure.prerequisites.items.filter(prereq => {
    if (prereq.verificationType === 'automatic') {
      return checkResults[prereq.id] !== true;
    }
    return !engineConfirmedPrerequisites.includes(prereq.id);
  });

  // Annoncer l'étape quand elle change
  useEffect(() => {
    if (isRunning && currentStep && voiceEnabled) {
      const remaining = totalSteps - currentStepIndex;
      const announcement = t('guide.stepAnnouncement', currentStep.order, totalSteps, currentStep.title, currentStep.description, currentStep.duration.display);
      speak(announcement);
    }
    return () => stopSpeaking();
  }, [currentStepIndex, isRunning, voiceEnabled]);

  // Alerte vocale à 80% du temps
  useEffect(() => {
    if (!isRunning || !currentStep?.duration.value || !voiceEnabled) return;
    
    const pct = elapsed / currentStep.duration.value;
    if (pct >= 0.8 && pct < 0.85) {
      const remaining = currentStep.duration.value - elapsed;
      speak(`Attention, il reste ${remaining} secondes pour cette étape.`);
    }
  }, [elapsed, currentStep?.duration.value, isRunning, voiceEnabled]);

  // Vérifier le timeout de l'étape
  useEffect(() => {
    if (isRunning && currentStep?.validation.timeout && elapsed >= currentStep.validation.timeout.value) {
      if (currentStep.validation.timeout.action === 'abort') {
        fail(t('guide.timeoutReached', currentStep.title));
        speak(t('guide.timeoutReached', currentStep.title));
      }
    }
  }, [elapsed, currentStep, isRunning, fail]);

  // Conseiller RAG contextuel (connectivité RAG du Guide)
  useEffect(() => {
    if (adviceAbortRef.current) adviceAbortRef.current.abort();

    if (phase === 'active' && isRunning && currentStep) {
      const controller = new AbortController();
      adviceAbortRef.current = controller;
      setIsAssistantLoading(true);
      const timer = setTimeout(() => {
        procedureAssistant.getStepAdvice(procedure, {
          currentStepIndex,
          status,
          completedSteps: stepReport.filter(r => r.status === 'completed').map(r => r.stepId),
          activeAlarms: alarm || [],
          confirmedPrerequisites: [...engineConfirmedPrerequisites],
        } as any).then(res => {
          if (!controller.signal.aborted) {
            setAdvice(res);
            setIsAssistantLoading(false);
          }
        }).catch(() => {
          if (!controller.signal.aborted) setIsAssistantLoading(false);
        });
      }, 400);
      return () => clearTimeout(timer);
    }

    setAdvice(null);
    setIsAssistantLoading(false);
  }, [phase, isRunning, currentStepIndex, status, procedure, stepReport, alarm, engineConfirmedPrerequisites]);

  const handleEnterPrerequisites = () => {
    setPhase('active');
    start();
  };

  const handleConfirmPrerequisite = (id: string) => {
    confirmPrerequisite(id);
  };

  const handleConfirmAllPrerequisites = () => {
    confirmAllPrerequisites();
  };

  const handleNextStep = () => {
    const hasAlarm = alarm && alarm.length > 0 ? true : undefined;
    nextStep(elapsed, hasAlarm);
    if (currentStepIndex < totalSteps - 1) {
      const nextIndex = currentStepIndex + 1;
      speak(`${t('guide.stepCompleted')} ${nextIndex + 1} : ${procedure.steps[nextIndex].title}. ${t('common.estimatedTime')} : ${procedure.steps[nextIndex].duration.display}`);
    } else {
      speak(t('guide.procedureCompleted'));
    }
  };

  const handlePreviousStep = () => {
    previousStep();
    speak(`${t('guide.returnToStep')} ${currentStepIndex} : ${procedure.steps[currentStepIndex - 1].title}`);
  };

  const handleTogglePause = () => {
    togglePause();
    speak(isPaused ? t('guide.pauseResume') : t('guide.pause'));
  };

  const handleSkipStep = () => {
    skipStep(elapsed);
    const nextIndex = currentStepIndex + 1;
      speak(`${t('guide.stepSkipped')} ${nextIndex + 1} : ${procedure.steps[nextIndex].title}`);
  };

  const handleRepeatStep = () => {
    repeatStep();
      speak(`${t('guide.stepRepeat')} ${currentStep?.order} : ${currentStep?.title}. ${currentStep?.description}`);
  };

  const handleTriggerAlarm = () => {
    if (currentStep?.alarms && currentStep.alarms.length > 0) {
      triggerAlarm(currentStep.alarms[0].code);
      speak(`Alerte critique : ${currentStep.alarms[0].description}. ${currentStep.alarms[0].remedy.title}`);
    }
  };

  const handleResolveAlarm = () => {
    resolveAlarm(alarm?.[0] || '');
    speak("Alerte résolue. Reprise de la procédure.");
  };

  const handleRestart = () => {
    restart();
    setPhase('active');
    setCheckResults({});
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    if (secs === 0) return `${mins}min`;
    return `${mins}min ${secs}s`;
  };

  const getCriticalityColor = (criticality: string) => {
    switch (criticality) {
      case 'critical': return 'border-destructive/50 text-destructive';
      case 'high': return 'border-orange-500/50 text-orange-500';
      default: return 'border-secondary/50 text-secondary';
    }
  };

  const handleAddMedia = (stepIndex: number, field: 'image' | 'video' | 'diagram', value: string) => {
    setLocalProcedure(prev => ({
      ...prev,
      steps: prev.steps.map((step: any, idx: number) =>
        idx === stepIndex
          ? {
              ...step,
              media: {
                ...step.media,
                [field]: {
                  url: value,
                  caption: step.media?.[field]?.caption || '',
                  ...(field === 'image' ? { alt: step.media?.image?.alt || '' } : {}),
                },
              },
            }
          : step
      ),
    }));
  };

  const handleRemoveMedia = (stepIndex: number, field: 'image' | 'video' | 'diagram') => {
    setLocalProcedure(prev => ({
      ...prev,
      steps: prev.steps.map((step: any, idx: number) =>
        idx === stepIndex
          ? {
              ...step,
              media: {
                ...step.media,
                [field]: undefined,
              },
            }
          : step
      ),
    }));
  };

  const handleUpdateCaption = (stepIndex: number, field: 'image' | 'video' | 'diagram', caption: string) => {
    setLocalProcedure(prev => ({
      ...prev,
      steps: prev.steps.map((step: any, idx: number) =>
        idx === stepIndex
          ? {
              ...step,
              media: {
                ...step.media,
                [field]: { ...step.media?.[field], caption },
              },
            }
          : step
      ),
    }));
  };

  const handleSaveEdits = () => {
    setMediaEditorOpen(false);
    speak("Médias mis à jour");
    if (onComplete) onComplete(localProcedure);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-card/30 p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={cn("text-micro font-code uppercase font-bold", getCriticalityColor(localProcedure.metadata.criticality))}>
                {localProcedure.metadata.criticality}
              </Badge>
              <span className="text-2xs font-code text-muted-foreground uppercase">{localProcedure.metadata.code}</span>
            </div>
            <h1 className="text-sm lg:text-base font-headline font-bold uppercase tracking-tight">{localProcedure.metadata.title}</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              title={voiceEnabled ? "Couper la voix" : "Activer la voix"}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowStepNavigator(!showStepNavigator)}
              title="Navigateur d'étapes"
            >
              {showStepNavigator ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", mediaEditorOpen && "text-primary bg-primary/10")}
              onClick={() => setMediaEditorOpen(true)}
              title="Mode édition des médias"
            >
              <Edit3 className="w-4 h-4" />
            </Button>
            <Badge variant="outline" className="text-micro font-code">
              Étape {currentStepIndex + 1} / {totalSteps}
            </Badge>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <Progress value={progress} className="h-1.5 bg-muted" />
        </div>

        {/* Step Navigator */}
        {showStepNavigator && phase === 'active' && status !== 'PREREQUISITES_CHECK' && (
          <div className="mt-4 p-3 bg-black/20 rounded-sm border border-border">
            <div className="flex flex-wrap gap-2">
              {localProcedure.steps.map((step, idx) => {
                const hasCritical = step.alarms?.some(a => a.severity === 'critical');
                return (
                  <Button
                    key={step.id}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-auto px-3 py-2 text-tiny font-code uppercase flex-col items-start gap-1",
                      idx === currentStepIndex && isRunning
                        ? "bg-primary/20 text-primary border border-primary/40"
                        : idx < currentStepIndex
                        ? "bg-secondary/20 text-secondary border border-secondary/40"
                        : "bg-muted/10 border-border text-muted-foreground hover:text-white"
                    )}
                    onClick={() => {
                      if (idx <= currentStepIndex || isCompleted) {
                        const newIndex = idx;
                        // Use previousStep repeatedly to go back, or just set index via restart
                        // For simplicity, navigate by restarting from that point
                        // Actually the hook doesn't support jump-to-step, so we just update the step index
                        // We'll use a workaround: the engine doesn't support jump, so skip this for now
                      }
                    }}
                  >
                    <span>{idx + 1}. {step.title}</span>
                    <span className="text-micro opacity-70">{step.duration.display}</span>
                    {hasCritical && (
                      <span className="text-micro text-destructive font-bold">CRITICAL</span>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Media Editor Modal */}
        {currentStep && (
          <MediaEditor
            step={currentStep}
            stepIndex={currentStepIndex}
            open={mediaEditorOpen}
            onOpenChange={setMediaEditorOpen}
            onSave={handleSaveEdits}
            onAddMedia={handleAddMedia}
            onRemoveMedia={handleRemoveMedia}
            onUpdateCaption={handleUpdateCaption}
          />
        )}
       </div>

       {/* Briefing */}
       {phase === 'briefing' && (
         <BriefingStage
           procedure={procedure}
           getCriticalityColor={getCriticalityColor}
           onContinue={handleEnterPrerequisites}
         />
       )}

       {/* Prerequisites */}
       {phase === 'active' && status === 'PREREQUISITES_CHECK' && (
         <PrerequisitesStage
           prerequisites={procedure.prerequisites}
           autoChecking={autoChecking}
           checkResults={checkResults}
           confirmedPrerequisites={new Set(engineConfirmedPrerequisites)}
           onTogglePrerequisite={(id) => {
             handleConfirmPrerequisite(id);
           }}
           onStartProcedure={() => {}}
           speak={speak}
         />
       )}

        {/* Running */}
        {phase === 'active' && isRunning && currentStep && (
          <RunningStage
            currentStep={currentStep}
            currentStepIndex={currentStepIndex}
            totalSteps={totalSteps}
            elapsed={elapsed}
            isPaused={isPaused}
            warningTime={false}
            progress={progress}
            procedure={procedure}
            onNext={handleNextStep}
            onPrevious={handlePreviousStep}
            onTogglePause={handleTogglePause}
            onRepeat={handleRepeatStep}
            onSkip={handleSkipStep}
            onTriggerAlarm={handleTriggerAlarm}
            formatDuration={formatDuration}
            stepReport={stepReport}
          />
        )}

        {/* Copilote RAG */}
        {phase === 'active' && isRunning && currentStep && (
          <Card className="p-4 border-secondary/20 bg-secondary/5 space-y-4 mt-4">
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
              <div className="py-6 flex flex-col items-center justify-center opacity-30">
                <Sparkles className="w-8 h-8 mb-2" />
                <p className="text-tiny font-code uppercase text-center">Traitement contextuel...</p>
              </div>
            )}
          </Card>
        )}

       {/* Completed */}
       {phase === 'active' && isCompleted && (
         <CompletedStage
           procedure={procedure}
           stepReport={stepReport}
           formatDuration={formatDuration}
           onRestart={handleRestart}
           onExportJson={exportJson}
           onPrint={() => window.print()}
         />
       )}

        {/* Aborted */}
        {phase === 'active' && isAborted && (
          <AbortedStage
            stepReport={stepReport}
            formatDuration={formatDuration}
            onRestart={handleRestart}
          />
        )}

        {/* Failed */}
        {phase === 'active' && isFailed && (
          <Card className="h-full flex flex-col items-center justify-center p-12 text-center panel-card shadow-2xl border-destructive/30">
            <AlertTriangle className="w-16 h-16 text-destructive mb-6" />
            <h2 className="text-2xl font-headline font-bold uppercase mb-2 text-destructive">Échec de la procédure</h2>
            <p className="text-muted-foreground font-code text-sm max-w-md mb-8 uppercase">
              La procédure a échoué en raison d'un dépassement de délai critique. Consultez le rapport d'exécution.
            </p>
            <div className="flex gap-4">
              <Button variant="outline" onClick={handleRestart} className="h-10 text-[10px] uppercase font-bold px-8">
                <RotateCcw className="w-4 h-4 mr-2" /> Réinitialiser
              </Button>
              <Button onClick={exportJson} className="h-10 text-[10px] uppercase font-bold bg-destructive text-destructive-foreground px-8 shadow-xl">
                Télécharger le rapport
              </Button>
            </div>
          </Card>
        )}

       {/* Alarm Modal */}
       {alarm && alarm.length > 0 && (
         <AlarmModal
           alarm={{
             code: alarm[0],
             description: currentStep?.alarms?.find(a => a.code === alarm[0])?.description || 'Alerte',
             remedy: currentStep?.alarms?.find(a => a.code === alarm[0])?.remedy || { title: '', description: '', steps: [] }
           }}
           onResolve={handleResolveAlarm}
           onClose={() => resolveAlarm(alarm[0])}
         />
       )}
     </div>
   );
 }
