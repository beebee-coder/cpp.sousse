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
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimerRing } from '@/components/ui/timer-ring';

export interface ProcedureStep {
  id: string;
  order: number;
  title: string;
  subtitle?: string;
  description: string;
  duration: {
    value: number;
    unit: string;
    display: string;
    type: string;
  };
  action: {
    type: string;
    instruction: string;
    expectedConfirmation?: string;
    target?: number;
    valveId?: string;
    command?: string;
    operation?: string;
    speed?: string;
    ui?: {
      component?: string;
      label?: string;
      icon?: string;
      color?: string;
    };
  };
  validation: {
    conditions: Array<{
      id: string;
      description: string;
      type: string;
      displayName?: string;
      value?: number | string;
      unit?: string;
    }>;
    successExpression: string;
    timeout?: {
      value: number;
      unit: string;
      action: string;
    };
  };
  alarms?: Array<{
    id: string;
    code: string;
    type: string;
    severity: string;
    description: string;
    remedy: {
      title: string;
      description: string;
      steps: string[];
      estimatedTime: number;
      tools?: string[];
      safety?: string[];
    };
  }>;
  notes?: string[];
}

interface ProcedureGuideProps {
  procedure: {
    metadata: {
      title: string;
      code: string;
      criticality: string;
    };
    prerequisites: {
      items: Array<{
        id: string;
        displayName: string;
        description: string;
        expectedState: string;
        verificationType: string;
        sensorRef?: string;
        condition?: string;
        threshold?: number | string;
      }>;
    };
    steps: ProcedureStep[];
    postExecution?: {
      checks: Array<{
        id: string;
        description: string;
        condition?: string;
        interval?: number;
      }>;
    };
  };
  onComplete?: (report: any) => void;
}

type GuideStatus = 'prerequisites' | 'running' | 'completed' | 'aborted';

interface StepReport {
  stepId: string;
  title: string;
  startedAt: string;
  finishedAt: string;
  duration: number;
  status: 'completed' | 'skipped' | 'timeout';
  alarms?: string[];
}

export function ProcedureGuide({ procedure, onComplete }: ProcedureGuideProps) {
  const [status, setStatus] = useState<GuideStatus>('prerequisites');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [confirmedPrerequisites, setConfirmedPrerequisites] = useState<Set<string>>(new Set());
  const [autoChecking, setAutoChecking] = useState(false);
  const [checkResults, setCheckResults] = useState<Record<string, boolean>>({});
  const [alarm, setAlarm] = useState<NonNullable<ProcedureStep['alarms']>[number] | null>(null);
  const [stepReport, setStepReport] = useState<StepReport[]>([]);
  const [showStepNavigator, setShowStepNavigator] = useState(false);
  const [warningTime, setWarningTime] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const stepStartRef = useRef<number>(Date.now());

  const currentStep = procedure.steps[currentStepIndex];
  const totalSteps = procedure.steps.length;
  const progress = status === 'prerequisites' ? 0 : ((currentStepIndex) / totalSteps) * 100;

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
        results[prereq.id] = confirmedPrerequisites.has(prereq.id);
      }
    }
    
    setCheckResults(results);
    setAutoChecking(false);
    return results;
  }, [procedure.prerequisites.items, confirmedPrerequisites]);

  // Vérifier les prérequis automatiques au montage
  useEffect(() => {
    if (status === 'prerequisites') {
      checkPrerequisites();
    }
  }, [status]);

  const allPrerequisitesMet = () => {
    return procedure.prerequisites.items.every(prereq => {
      if (prereq.verificationType === 'automatic') {
        return checkResults[prereq.id] === true;
      }
      return confirmedPrerequisites.has(prereq.id);
    });
  };

  const unmetPrerequisites = procedure.prerequisites.items.filter(prereq => {
    if (prereq.verificationType === 'automatic') {
      return checkResults[prereq.id] !== true;
    }
    return !confirmedPrerequisites.has(prereq.id);
  });

  // Annoncer l'étape quand elle change
  useEffect(() => {
    if (status === 'running' && currentStep && voiceEnabled) {
      const remaining = totalSteps - currentStepIndex;
      const announcement = `Étape ${currentStep.order} sur ${totalSteps} : ${currentStep.title}. ${currentStep.description}. Temps estimé : ${currentStep.duration.display}.`;
      speak(announcement);
    }
    return () => stopSpeaking();
  }, [currentStepIndex, status, voiceEnabled]);

  // Timer pour l'étape courante
  useEffect(() => {
    if (status !== 'running' || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    stepStartRef.current = Date.now() - (elapsed * 1000);
    timerRef.current = setInterval(() => {
      const currentElapsed = Math.floor((Date.now() - stepStartRef.current) / 1000);
      setElapsed(currentElapsed);
      
      // Alerte vocale à 80% du temps
      if (currentStep?.duration.value && voiceEnabled) {
        const pct = currentElapsed / currentStep.duration.value;
        if (pct >= 0.8 && pct < 0.85) {
          setWarningTime(true);
          const remaining = currentStep.duration.value - currentElapsed;
          speak(`Attention, il reste ${remaining} secondes pour cette étape.`);
        }
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, isPaused, currentStep?.duration.value, voiceEnabled]);

  // Vérifier le timeout de l'étape
  useEffect(() => {
    if (status === 'running' && currentStep?.validation.timeout && elapsed >= currentStep.validation.timeout.value) {
      if (currentStep.validation.timeout.action === 'abort') {
        setStatus('aborted');
        speak(`Timeout atteint pour l'étape ${currentStep.title}. Procédure interrompue.`);
      }
    }
  }, [elapsed, currentStep, status]);

  const handleStartProcedure = () => {
    setStatus('running');
    setCurrentStepIndex(0);
    setElapsed(0);
    setStepReport([]);
    stepStartRef.current = Date.now();
    speak("Démarrage de la procédure. Première étape : " + procedure.steps[0].title + ". Durée estimée : " + procedure.steps[0].duration.display);
  };

  const handleNextStep = () => {
    if (currentStepIndex < totalSteps - 1) {
      const stepDuration = Math.floor((Date.now() - stepStartRef.current) / 1000);
      setStepReport(prev => [...prev, {
        stepId: currentStep.id,
        title: currentStep.title,
        startedAt: new Date(stepStartRef.current).toISOString(),
        finishedAt: new Date().toISOString(),
        duration: stepDuration,
        status: elapsed > currentStep.duration.value ? 'timeout' : 'completed',
        alarms: alarm ? [alarm.code] : undefined
      }]);
      
      setAlarm(null);
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      setElapsed(0);
      setWarningTime(false);
      stepStartRef.current = Date.now();
      speak(`Étape terminée. Passage à l'étape ${nextIndex + 1} : ${procedure.steps[nextIndex].title}. Durée estimée : ${procedure.steps[nextIndex].duration.display}`);
    } else {
      const stepDuration = Math.floor((Date.now() - stepStartRef.current) / 1000);
      setStepReport(prev => [...prev, {
        stepId: currentStep.id,
        title: currentStep.title,
        startedAt: new Date(stepStartRef.current).toISOString(),
        finishedAt: new Date().toISOString(),
        duration: stepDuration,
        status: 'completed'
      }]);
      
      setStatus('completed');
      speak("Procédure terminée avec succès. Toutes les étapes ont été complétées. Vérifiez les paramètres post-exécution avant de quitter.");
      
      if (onComplete) {
        onComplete({
          procedureCode: procedure.metadata.code,
          completedAt: new Date().toISOString(),
          totalDuration: stepReport.reduce((sum, r) => sum + r.duration, 0) + stepDuration,
          steps: [...stepReport, {
            stepId: currentStep.id,
            title: currentStep.title,
            startedAt: new Date(stepStartRef.current).toISOString(),
            finishedAt: new Date().toISOString(),
            duration: stepDuration,
            status: 'completed'
          }]
        });
      }
    }
  };

  const handlePreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      setElapsed(0);
      setWarningTime(false);
      stepStartRef.current = Date.now();
      speak(`Retour à l'étape ${currentStepIndex} : ${procedure.steps[currentStepIndex - 1].title}`);
    }
  };

  const handleTogglePause = () => {
    setIsPaused(!isPaused);
    if (!isPaused) {
      stepStartRef.current = Date.now() - (elapsed * 1000);
    }
    speak(isPaused ? "Reprise de la procédure" : "Procédure en pause");
  };

  const handleSkipStep = () => {
    if (currentStepIndex < totalSteps - 1) {
      setStepReport(prev => [...prev, {
        stepId: currentStep.id,
        title: currentStep.title,
        startedAt: new Date(stepStartRef.current).toISOString(),
        finishedAt: new Date().toISOString(),
        duration: elapsed,
        status: 'skipped'
      }]);
      
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      setElapsed(0);
      setWarningTime(false);
      stepStartRef.current = Date.now();
      speak(`Étape ${currentStepIndex} ignorée. Passage à l'étape ${nextIndex + 1} : ${procedure.steps[nextIndex].title}`);
    }
  };

  const handleRepeatStep = () => {
    speak(`Rappel étape ${currentStep.order} : ${currentStep.title}. ${currentStep.description}`);
  };

  const handleTriggerAlarm = () => {
    if (currentStep.alarms && currentStep.alarms.length > 0) {
      setAlarm(currentStep.alarms[0]);
      speak(`Alerte critique : ${currentStep.alarms[0].description}. ${currentStep.alarms[0].remedy.title}`);
    }
  };

  const resolveAlarm = () => {
    setAlarm(null);
    speak("Alerte résolue. Reprise de la procédure.");
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

  const getStepStatusColor = (index: number) => {
    if (index < currentStepIndex) return 'bg-secondary text-secondary-foreground';
    if (index === currentStepIndex && status === 'running') return 'bg-primary text-primary-foreground';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-card/30 p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={cn("text-[8px] font-code uppercase font-bold", getCriticalityColor(procedure.metadata.criticality))}>
                {procedure.metadata.criticality}
              </Badge>
              <span className="text-[10px] font-code text-muted-foreground uppercase">{procedure.metadata.code}</span>
            </div>
            <h1 className="text-sm lg:text-base font-headline font-bold uppercase tracking-tight">{procedure.metadata.title}</h1>
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
            <Badge variant="outline" className="text-[8px] font-code">
              Étape {currentStepIndex + 1} / {totalSteps}
            </Badge>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <Progress value={progress} className="h-1.5 bg-muted" />
        </div>

        {/* Step Navigator */}
        {showStepNavigator && status !== 'prerequisites' && (
          <div className="mt-4 p-3 bg-black/20 rounded-sm border border-border">
            <div className="flex flex-wrap gap-2">
              {procedure.steps.map((step, idx) => (
                <Button
                  key={step.id}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 px-3 text-[9px] font-code uppercase",
                    idx === currentStepIndex && "bg-primary/20 text-primary border border-primary/40",
                    idx < currentStepIndex && "bg-secondary/20 text-secondary border border-secondary/40"
                  )}
                  onClick={() => {
                    if (idx <= currentStepIndex || status === 'completed') {
                      setCurrentStepIndex(idx);
                      setElapsed(0);
                      setWarningTime(false);
                      stepStartRef.current = Date.now();
                    }
                  }}
                >
                  {idx + 1}. {step.title}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Prerequisites */}
      {status === 'prerequisites' && (
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-center space-y-2 mb-8">
              <ShieldCheck className="w-12 h-12 text-primary mx-auto" />
              <h2 className="text-lg font-headline font-bold uppercase">Prérequis Obligatoires</h2>
              <p className="text-xs text-muted-foreground font-code">Vérifiez chaque condition avant le démarrage</p>
            </div>

            {autoChecking && (
              <div className="text-center py-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-sm">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-code text-primary uppercase">Vérification automatique des capteurs...</span>
                </div>
              </div>
            )}

            <div className="grid gap-4">
              {procedure.prerequisites.items.map((prereq) => {
                const autoChecked = prereq.verificationType === 'automatic';
                const isChecked = autoChecked ? checkResults[prereq.id] === true : confirmedPrerequisites.has(prereq.id);
                const isChecking = autoChecked && !checkResults[prereq.id];

                return (
                  <Card
                    key={prereq.id}
                    className={cn(
                      "p-4 border transition-all",
                      isChecked
                        ? "bg-secondary/10 border-secondary/40"
                        : autoChecking
                        ? "bg-card/40 border-border opacity-60"
                        : "bg-card/40 border-border hover:border-primary/40"
                    )}
                    onClick={() => {
                      if (!autoChecked) {
                        const newConfirmed = new Set(confirmedPrerequisites);
                        if (confirmedPrerequisites.has(prereq.id)) {
                          newConfirmed.delete(prereq.id);
                        } else {
                          newConfirmed.add(prereq.id);
                          speak(`Prérequis confirmé : ${prereq.displayName}`);
                        }
                        setConfirmedPrerequisites(newConfirmed);
                      }
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                        isChecked
                          ? "bg-secondary border-secondary text-secondary-foreground"
                          : isChecking
                          ? "border-primary/40 animate-pulse"
                          : "border-muted-foreground/30"
                      )}>
                        {isChecked && <CheckCircle2 className="w-4 h-4" />}
                        {isChecking && <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold uppercase">{prereq.displayName}</span>
                          <Badge variant="outline" className={cn(
                            "text-[7px] font-code h-4",
                            isChecked ? "border-secondary/40 text-secondary" : "border-muted-foreground/30 text-muted-foreground"
                          )}>
                            {prereq.verificationType}
                          </Badge>
                        </div>
                        <p className="text-[10px] font-code text-muted-foreground mb-2">{prereq.description}</p>
                        {prereq.sensorRef && (
                          <p className="text-[9px] font-code text-primary/70">
                            Capteur: {prereq.sensorRef} | Condition: {prereq.condition} | Seuil: {prereq.threshold}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {unmetPrerequisites.length > 0 && (
              <Card className="p-4 bg-destructive/5 border-destructive/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-destructive uppercase mb-1">Prérequis non satisfaits</p>
                    <p className="text-[10px] font-code text-muted-foreground">
                      {unmetPrerequisites.map(p => p.displayName).join(', ')}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            <div className="pt-6 flex justify-center">
              <Button
                size="lg"
                disabled={!allPrerequisitesMet()}
                onClick={handleStartProcedure}
                className="px-12 h-14 bg-secondary text-secondary-foreground font-bold uppercase text-sm shadow-[0_0_30px_rgba(46,184,146,0.4)] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-5 h-5 mr-3" />
                Démarrer la Procédure
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Running / Completed */}
      {(status === 'running' || status === 'completed' || status === 'aborted') && currentStep && (
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-5xl mx-auto space-y-6">
            
            {/* Step Counter & Timer */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-full border-2 flex items-center justify-center font-code font-bold text-lg transition-all",
                  status === 'completed' || currentStepIndex < currentStepIndex
                    ? "bg-secondary/20 border-secondary/40 text-secondary"
                    : status === 'aborted'
                    ? "bg-destructive/20 border-destructive/40 text-destructive"
                    : "bg-primary/10 border-primary/40 text-primary"
                )}>
                  {currentStep.order}
                </div>
                <div>
                  <h2 className="text-base lg:text-lg font-headline font-bold uppercase">{currentStep.title}</h2>
                  {currentStep.subtitle && (
                    <p className="text-[10px] font-code text-muted-foreground uppercase">{currentStep.subtitle}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Timer circulaire animé */}
                <TimerRing
                  elapsed={elapsed}
                  total={currentStep.duration.value}
                  display={currentStep.duration.display}
                  state={
                    status === 'aborted' || elapsed > currentStep.duration.value
                      ? 'danger'
                      : warningTime
                      ? 'warning'
                      : 'normal'
                  }
                />

                {/* Voice Toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                >
                  {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>

            {/* Progress Bar */}
            <Progress value={progress} className="h-1.5 bg-muted" />

            {/* Step Indicators */}
            <div className="flex flex-wrap gap-2">
              {procedure.steps.map((step, idx) => (
                <div
                  key={step.id}
                  className={cn(
                    "px-3 py-1.5 rounded-sm border text-[9px] font-code uppercase transition-all",
                    idx === currentStepIndex && status === 'running'
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : idx < currentStepIndex
                      ? "bg-secondary/20 border-secondary/40 text-secondary"
                      : "bg-muted/10 border-border text-muted-foreground"
                  )}
                >
                  {idx + 1}. {step.title}
                </div>
              ))}
            </div>

            {/* Main Content */}
            {status === 'running' && (
              <Card className="p-6 lg:p-8 border-border bg-card/40">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Instructions */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="p-6 bg-black/40 border-l-2 border-primary rounded-sm">
                      <p className="text-sm sm:text-base font-code leading-relaxed text-foreground/90 mb-4">
                        {currentStep.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                          Directive S-101 : Suivre les consignes de sécurité
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3">
                      {currentStep.action.type === 'confirmation' && (
                        <Button
                          onClick={handleNextStep}
                          className="px-8 h-12 bg-secondary text-secondary-foreground font-bold uppercase text-sm shadow-[0_0_20px_rgba(46,184,146,0.3)]"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          {currentStep.action.ui?.label || 'Confirmer'}
                        </Button>
                      )}

                      {currentStep.action.type === 'command' && (
                        <Button
                          onClick={handleNextStep}
                          className="px-8 h-12 bg-primary text-primary-foreground font-bold uppercase"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          {currentStep.action.ui?.label || 'Exécuter'}
                        </Button>
                      )}

                      {currentStep.action.type === 'valve_operation' && (
                        <div className="flex items-center gap-4 p-3 bg-black/40 border border-primary/20 rounded-sm">
                          <Button onClick={handleNextStep} className="bg-primary text-primary-foreground font-bold uppercase px-6 h-10">
                            <Settings2 className="w-4 h-4 mr-2" />
                            {currentStep.action.ui?.label || 'Actionner'}
                          </Button>
                          <div>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase">Cible</p>
                            <p className="text-xl font-code font-bold text-primary">{currentStep.action.target}%</p>
                          </div>
                        </div>
                      )}

                      {currentStep.action.type === 'wait' && (
                        <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border border-primary/20 rounded-sm">
                          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                          <span className="text-xs font-code text-primary uppercase">Stabilisation en cours...</span>
                        </div>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTogglePause}
                        className="h-10"
                      >
                        {isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                        {isPaused ? 'Reprendre' : 'Pause'}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRepeatStep}
                        className="h-10"
                      >
                        <Volume2 className="w-4 h-4 mr-2" />
                        Répéter
                      </Button>

                      {currentStepIndex < totalSteps - 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSkipStep}
                          className="h-10 text-muted-foreground"
                        >
                          <SkipForward className="w-4 h-4 mr-2" />
                          Passer
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePreviousStep}
                        disabled={currentStepIndex === 0}
                        className="h-10"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Précédent
                      </Button>
                    </div>
                  </div>

                  {/* Side Panel */}
                  <div className="space-y-4">
                    {/* Validation Conditions */}
                    {currentStep.validation.conditions.length > 0 && (
                      <Card className="p-4 bg-black/40 border-border">
                        <h4 className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                          Validation temps réel
                        </h4>
                        <div className="space-y-2">
                          {currentStep.validation.conditions.map((cond) => (
                            <div key={cond.id} className="flex items-center justify-between p-2 bg-muted/10 rounded-sm">
                              <span className="text-[10px] font-code text-white/80 uppercase truncate">
                                {cond.displayName || cond.description}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-code font-bold text-secondary">
                                  {cond.value} {cond.unit}
                                </span>
                                <CheckCircle2 className="w-3.5 h-3.5 text-secondary" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}

                    {/* Alarms */}
                    {currentStep.alarms && currentStep.alarms.length > 0 && (
                      <Card className="p-4 bg-destructive/5 border-destructive/30">
                        <h4 className="text-[9px] font-bold text-destructive uppercase tracking-widest mb-3">
                          Alarmes possibles
                        </h4>
                        {currentStep.alarms.map((alarmItem) => (
                          <div key={alarmItem.id} className="space-y-2">
                            <p className="text-[10px] font-code text-destructive/90">{alarmItem.description}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleTriggerAlarm}
                              className="w-full h-8 text-[10px] border-destructive/30 text-destructive hover:bg-destructive/10"
                            >
                              <AlertTriangle className="w-3 h-3 mr-2" />
                              Simuler l'alarme
                            </Button>
                          </div>
                        ))}
                      </Card>
                    )}

                    {/* Notes */}
                    {currentStep.notes && currentStep.notes.length > 0 && (
                      <Card className="p-4 bg-primary/5 border-primary/20">
                        <h4 className="text-[9px] font-bold text-primary uppercase tracking-widest mb-2">
                          Notes opérateur
                        </h4>
                        <ul className="space-y-1">
                          {currentStep.notes.map((note, idx) => (
                            <li key={idx} className="text-[10px] font-code text-muted-foreground uppercase leading-tight">
                              - {note}
                            </li>
                          ))}
                        </ul>
                      </Card>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Completed */}
            {status === 'completed' && (
              <Card className="p-8 bg-secondary/5 border-secondary/30 space-y-6">
                <div className="text-center space-y-4">
                  <CheckCircle2 className="w-16 h-16 text-secondary mx-auto" />
                  <h2 className="text-xl font-headline font-bold uppercase text-secondary">Procédure Terminée</h2>
                  <p className="text-sm text-muted-foreground font-code max-w-md mx-auto">
                    Toutes les étapes ont été complétées avec succès. Vérifiez les paramètres post-exécution avant de quitter.
                  </p>
                </div>

                {stepReport.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2">Rapport d'exécution</h3>
                    <div className="max-h-40 overflow-y-auto space-y-2 terminal-scroll">
                      {stepReport.map((report, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-black/20 rounded-sm">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-[7px] font-code h-4">
                              Étape {idx + 1}
                            </Badge>
                            <span className="text-xs font-code text-white/80">{report.title}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-code text-muted-foreground">
                              {formatDuration(report.duration)}
                            </span>
                            <Badge variant="outline" className={cn(
                              "text-[7px] font-code h-4",
                              report.status === 'completed' && "border-secondary/40 text-secondary",
                              report.status === 'timeout' && "border-destructive/40 text-destructive",
                              report.status === 'skipped' && "border-orange-500/40 text-orange-500"
                            )}>
                              {report.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {procedure.postExecution?.checks && (
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Vérifications post-exécution</h3>
                    {procedure.postExecution.checks.map((check) => (
                      <div key={check.id} className="flex items-center gap-2 p-3 bg-black/20 rounded-sm">
                        <CheckCircle2 className="w-4 h-4 text-secondary" />
                        <span className="text-xs font-code text-left">{check.description}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-4 flex justify-center gap-3">
                  <Button onClick={() => { 
                    setStatus('prerequisites'); 
                    setCurrentStepIndex(0); 
                    setElapsed(0); 
                    setStepReport([]);
                    setWarningTime(false);
                    setCheckResults({});
                  }} className="uppercase text-xs">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Recommencer
                  </Button>
                  <Button variant="outline" onClick={() => window.print()} className="uppercase text-xs">
                    Imprimer le rapport
                  </Button>
                </div>
              </Card>
            )}

            {/* Aborted */}
            {status === 'aborted' && (
              <Card className="p-8 bg-destructive/5 border-destructive/30 text-center space-y-4">
                <AlertTriangle className="w-16 h-16 text-destructive mx-auto" />
                <h2 className="text-xl font-headline font-bold uppercase text-destructive">Procédure Interrompue</h2>
                <p className="text-sm text-muted-foreground font-code max-w-md mx-auto">
                  La procédure a été interrompue suite à un timeout ou une anomalie. Consultez le superviseur avant de reprendre.
                </p>
                {stepReport.length > 0 && (
                  <div className="pt-4 text-left max-w-md mx-auto">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Étapes complétées</h3>
                    <div className="space-y-1">
                      {stepReport.map((report, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-black/20 rounded-sm">
                          <span className="text-xs font-code">{report.title}</span>
                          <Badge variant="outline" className="text-[7px] font-code">
                            {formatDuration(report.duration)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="pt-4">
                  <Button onClick={() => { 
                    setStatus('prerequisites'); 
                    setCurrentStepIndex(0); 
                    setElapsed(0); 
                    setStepReport([]);
                    setWarningTime(false);
                  }} variant="outline" className="uppercase text-xs">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Réinitialiser
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Alarm Modal */}
      {alarm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-lg w-full p-6 bg-destructive/10 border-destructive/50 space-y-4">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-8 h-8 text-destructive shrink-0" />
              <div>
                <h3 className="text-lg font-headline font-bold text-destructive uppercase">{alarm.code}</h3>
                <p className="text-sm font-code text-destructive/90">{alarm.description}</p>
              </div>
            </div>
            
            <div className="p-4 bg-black/40 rounded-sm space-y-3">
              <h4 className="text-xs font-bold text-white uppercase">{alarm.remedy.title}</h4>
              <p className="text-xs text-muted-foreground">{alarm.remedy.description}</p>
              <ol className="list-decimal list-inside space-y-1">
                {alarm.remedy.steps.map((step: string, idx: number) => (
                  <li key={idx} className="text-xs font-code text-white/80">{step}</li>
                ))}
              </ol>
              {alarm.remedy.tools && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {alarm.remedy.tools.map((tool: string) => (
                    <Badge key={tool} variant="outline" className="text-[8px] font-code">{tool}</Badge>
                  ))}
                </div>
              )}
              {alarm.remedy.safety && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {alarm.remedy.safety.map((safety: string) => (
                    <Badge key={safety} variant="outline" className="text-[8px] font-code border-orange-500/30 text-orange-500">
                      {safety}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setAlarm(null)} className="uppercase text-xs">
                Fermer
              </Button>
              <Button onClick={resolveAlarm} className="bg-secondary text-secondary-foreground uppercase text-xs">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Problème Résolu
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
