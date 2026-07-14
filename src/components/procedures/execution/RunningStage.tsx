"use client";

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  AlertTriangle,
  Info,
  ShieldCheck,
  Play,
  RotateCcw,
  CheckCircle2,
  Settings2,
  Volume2,
  Pause,
  SkipForward
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimerRing } from '@/components/ui/timer-ring';
import { ProcedureStep } from '@/lib/procedures/types';
import { useTranslation } from '@/hooks/use-translation';

export interface RunningStageProps {
  currentStep: ProcedureStep;
  currentStepIndex: number;
  totalSteps: number;
  elapsed: number;
  isPaused: boolean;
  warningTime: boolean;
  progress: number;
  procedure: {
    steps: ProcedureStep[];
  };
  onNext: () => void;
  onPrevious: () => void;
  onTogglePause: () => void;
  onRepeat: () => void;
  onSkip: () => void;
  onTriggerAlarm: () => void;
  formatDuration: (seconds: number) => string;
  stepReport: Array<{
    stepId: string;
    title: string;
    duration: number;
    status: 'completed' | 'skipped' | 'timeout';
    alarms?: string[];
  }>;
}

export function RunningStage({
  currentStep,
  currentStepIndex,
  totalSteps,
  elapsed,
  isPaused,
  warningTime,
  progress,
  procedure,
  onNext,
  onPrevious,
  onTogglePause,
  onRepeat,
  onSkip,
  onTriggerAlarm,
  formatDuration,
  stepReport
}: RunningStageProps) {
  const t = useTranslation();
  return (
    <>
      {/* Step Counter & Timer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-full border-2 flex items-center justify-center font-code font-bold text-lg transition-all",
            currentStepIndex < currentStepIndex
              ? "bg-secondary/20 border-secondary/40 text-secondary"
              : "bg-primary/10 border-primary/40 text-primary"
          )}>
            {currentStep.order}
          </div>
          <div>
            <h2 className="text-base lg:text-lg font-headline font-bold uppercase">{currentStep.title}</h2>
            {currentStep.subtitle && (
              <p className="text-2xs font-code text-muted-foreground uppercase">{currentStep.subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <TimerRing
            elapsed={elapsed}
            total={currentStep.duration.value}
            display={currentStep.duration.display}
            state={
              elapsed > currentStep.duration.value
                ? 'danger'
                : warningTime
                ? 'warning'
                : 'normal'
            }
          />
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
              "px-3 py-1.5 rounded-sm border text-tiny font-code uppercase transition-all",
              idx === currentStepIndex
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
      <Card className="p-6 lg:p-8 panel-card">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Instructions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 terminal-card rounded-sm">
              <p className="text-sm sm:text-base font-code leading-relaxed text-foreground/90 mb-4">
                {currentStep.description}
              </p>
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-primary" />
                <span className="text-tiny font-bold text-muted-foreground uppercase tracking-widest">
                  Directive S-101 : Suivre les consignes de sécurité
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {currentStep.action.type === 'confirmation' && (
                <Button
                  onClick={onNext}
                  className="px-8 h-12 bg-secondary text-secondary-foreground font-bold uppercase text-sm shadow-[0_0_20px_rgba(46,184,146,0.3)]"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {currentStep.action.ui?.label || t('running.confirm')}
                </Button>
              )}

              {currentStep.action.type === 'command' && (
                <Button
                  onClick={onNext}
                  className="px-8 h-12 bg-primary text-primary-foreground font-bold uppercase"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {currentStep.action.ui?.label || t('running.execute')}
                </Button>
              )}

              {currentStep.action.type === 'valve_operation' && (
                <div className="flex items-center gap-4 p-3 bg-black/40 border border-primary/20 rounded-sm">
                  <Button onClick={onNext} className="bg-primary text-primary-foreground font-bold uppercase px-6 h-10">
                    <Settings2 className="w-4 h-4 mr-2" />
                    {currentStep.action.ui?.label || t('running.operate')}
                  </Button>
                  <div>
                    <p className="text-tiny font-bold text-muted-foreground uppercase">Cible</p>
                    <p className="text-xl font-code font-bold text-primary">{currentStep.action.target}%</p>
                  </div>
                </div>
              )}

              {currentStep.action.type === 'wait' && (
                <div className="flex items-center gap-3 px-4 py-2 info-card">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span className="text-xs font-code text-primary uppercase">{t('running.stabilizing')}</span>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={onTogglePause}
                className="h-10"
              >
                {isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                {isPaused ? t('running.resume') : t('running.pause')}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onRepeat}
                className="h-10"
              >
                <Volume2 className="w-4 h-4 mr-2" />
                {t('running.repeat')}
              </Button>

              {currentStepIndex < totalSteps - 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSkip}
                  className="h-10 text-muted-foreground"
                >
                  <SkipForward className="w-4 h-4 mr-2" />
                  {t('running.skip')}
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={onPrevious}
                disabled={currentStepIndex === 0}
                className="h-10"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('running.previous')}
              </Button>
            </div>
          </div>

          {/* Side Panel */}
          <div className="space-y-4">
            {/* Validation Conditions */}
            {currentStep.validation.conditions.length > 0 && (
              <Card className="p-4 terminal-card">
                <h4 className="text-tiny font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  {t('running.realTimeValidation')}
                </h4>
                <div className="space-y-2">
                  {currentStep.validation.conditions.map((cond) => (
                    <div key={cond.id} className="flex items-center justify-between p-2 bg-muted/10 rounded-sm">
                      <span className="text-2xs font-code text-white/80 uppercase truncate">
                        {cond.displayName || cond.description}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-2xs font-code font-bold text-secondary">
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
              <Card className="p-4 danger-card">
                <h4 className="text-tiny font-bold text-destructive uppercase tracking-widest mb-3">
                  {t('running.possibleAlarms')}
                </h4>
                <div className="space-y-3">
                  {currentStep.alarms.map((alarmItem) => (
                    <div key={alarmItem.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn(
                          "text-micro font-code h-4",
                          alarmItem.severity === 'critical' && "border-destructive/40 text-destructive",
                          alarmItem.severity === 'high' && "border-orange-500/40 text-orange-500",
                          alarmItem.severity === 'medium' && "border-yellow-500/40 text-yellow-500"
                        )}>
                          {alarmItem.code}
                        </Badge>
                        <span className="text-2xs font-code text-destructive/90">{alarmItem.description}</span>
                      </div>
                      <p className="text-tiny font-code text-muted-foreground">
                        <span className="text-white/70">Remède:</span> {alarmItem.remedy.title}
                      </p>
                      {alarmItem.remedy.tools && alarmItem.remedy.tools.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {alarmItem.remedy.tools.map((tool) => (
                            <Badge key={tool} variant="outline" className="text-micro font-code border-white/10 text-white/60">
                              {tool}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {alarmItem.remedy.safety && alarmItem.remedy.safety.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {alarmItem.remedy.safety.map((safety) => (
                            <Badge key={safety} variant="outline" className="text-micro font-code border-orange-500/30 text-orange-500">
                              {safety}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Fallbacks */}
            {currentStep.fallbacks && currentStep.fallbacks.length > 0 && (
              <Card className="p-4 warning-card">
                <h4 className="text-tiny font-bold text-yellow-500 uppercase tracking-widest mb-3">
                  {t('running.fallbackPlans')}
                </h4>
                <div className="space-y-2">
                  {currentStep.fallbacks.map((fallback) => (
                    <div key={fallback.id} className="p-2 bg-black/20 rounded-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-2xs font-bold text-yellow-500 uppercase">{fallback.title}</span>
                      </div>
                      <p className="text-tiny font-code text-muted-foreground">{fallback.description}</p>
                      <p className="text-tiny font-code text-white/70">
                        <span className="text-muted-foreground">Condition:</span> {fallback.condition}
                      </p>
                      <p className="text-tiny font-code text-yellow-500/80">
                        Durée estimée: {fallback.estimatedTime}s
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Media */}
            {currentStep.media && (
              <Card className="p-4 info-card">
                <h4 className="text-tiny font-bold text-primary uppercase tracking-widest mb-3">
                  Médias associés
                </h4>
                <div className="space-y-2">
                  {currentStep.media.image && (
                    <div className="flex items-center gap-2 p-2 bg-black/20 rounded-sm">
                      <div className="w-8 h-8 bg-primary/10 rounded-sm flex items-center justify-center shrink-0">
                        <span className="text-2xs font-code text-primary">IMG</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xs font-code text-white/80 truncate">{currentStep.media.image.caption || t('common.image')}</p>
                        <p className="text-micro font-code text-muted-foreground truncate">{currentStep.media.image.url}</p>
                      </div>
                    </div>
                  )}
                  {currentStep.media.video && (
                    <div className="flex items-center gap-2 p-2 bg-black/20 rounded-sm">
                      <div className="w-8 h-8 bg-primary/10 rounded-sm flex items-center justify-center shrink-0">
                        <span className="text-2xs font-code text-primary">VID</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xs font-code text-white/80 truncate">{currentStep.media.video.caption || t('common.video')}</p>
                        <p className="text-micro font-code text-muted-foreground truncate">{currentStep.media.video.url}</p>
                      </div>
                    </div>
                  )}
                  {currentStep.media.diagram && (
                    <div className="flex items-center gap-2 p-2 bg-black/20 rounded-sm">
                      <div className="w-8 h-8 bg-primary/10 rounded-sm flex items-center justify-center shrink-0">
                        <span className="text-2xs font-code text-primary">PDF</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xs font-code text-white/80 truncate">{currentStep.media.diagram.caption || 'Diagramme'}</p>
                        <p className="text-micro font-code text-muted-foreground truncate">{currentStep.media.diagram.url}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Notes */}
            {currentStep.notes && currentStep.notes.length > 0 && (
              <Card className="p-4 info-card">
                <h4 className="text-tiny font-bold text-primary uppercase tracking-widest mb-2">
                  Notes opérateur
                </h4>
                <ul className="space-y-1">
                  {currentStep.notes.map((note, idx) => (
                    <li key={idx} className="text-2xs font-code text-muted-foreground uppercase leading-tight">
                      - {note}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      </Card>
    </>
  );
}
