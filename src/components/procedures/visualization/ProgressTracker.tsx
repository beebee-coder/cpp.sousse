"use client";

import { ProcedureStep } from '@/lib/procedures/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
  GripVertical,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressTrackerProps {
  steps: ProcedureStep[];
  currentStepIndex: number;
  status: 'briefing' | 'prerequisites' | 'running' | 'completed' | 'aborted';
  onStepClick?: (index: number) => void;
  className?: string;
}

export function ProgressTracker({
  steps,
  currentStepIndex,
  status,
  onStepClick,
  className
}: ProgressTrackerProps) {
  const getStepStatus = (index: number) => {
    if (status === 'completed') return 'completed';
    if (index < currentStepIndex) return 'completed';
    if (index === currentStepIndex && status === 'running') return 'active';
    return 'pending';
  };

  const getStepIcon = (step: ProcedureStep, stepStatus: string) => {
    if (stepStatus === 'completed') {
      return <CheckCircle2 className="w-5 h-5 text-secondary" />;
    }
    if (stepStatus === 'active') {
      return (
        <div className="relative">
          <Zap className="w-5 h-5 text-primary animate-pulse" />
          <div className="absolute inset-0 w-5 h-5 bg-primary/30 rounded-full animate-ping" />
        </div>
      );
    }
    return <Circle className="w-5 h-5 text-muted-foreground/50" />;
  };

  const getStepColor = (step: ProcedureStep, stepStatus: string) => {
    if (stepStatus === 'completed') return 'border-secondary/40 bg-secondary/10';
    if (stepStatus === 'active') return 'border-primary/40 bg-primary/10';
    return 'border-border bg-muted/5';
  };

  const hasCriticalAlarm = (step: ProcedureStep) => {
    return step.alarms?.some(a => a.severity === 'critical');
  };

  return (
    <Card className={cn("p-4 panel-card", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          Timeline d'exécution
        </h3>
      </div>

      <div className="space-y-1">
        {steps.map((step, index) => {
          const stepStatus = getStepStatus(index);
          const isClickable = index <= currentStepIndex || status === 'completed' || status === 'aborted';
          const criticalAlarm = hasCriticalAlarm(step);

          return (
            <div
              key={step.id}
              className={cn(
                "relative flex items-start gap-3 p-3 rounded-sm border transition-all duration-300 cursor-default",
                getStepColor(step, stepStatus),
                isClickable && onStepClick && "cursor-pointer hover:border-primary/40 hover:bg-primary/5"
              )}
              onClick={() => isClickable && onStepClick?.(index)}
              role={isClickable ? "button" : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onKeyDown={(e) => {
                if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onStepClick?.(index);
                }
              }}
            >
              {/* Step indicator */}
              <div className="shrink-0 mt-0.5">
                {getStepIcon(step, stepStatus)}
              </div>

              {/* Step content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-code font-bold text-white/90 truncate">
                    {step.order}. {step.title}
                  </span>
                  {criticalAlarm && (
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-tiny font-code text-muted-foreground">
                    {step.duration.display}
                  </span>

                  <Badge
                    variant="outline"
                    className={cn(
                      "text-micro font-code h-4 uppercase",
                      stepStatus === 'completed' && "border-secondary/40 text-secondary",
                      stepStatus === 'active' && "border-primary/40 text-primary",
                      stepStatus === 'pending' && "border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    {stepStatus === 'completed' ? 'Terminée' :
                     stepStatus === 'active' ? 'En cours' : 'En attente'}
                  </Badge>

                  {step.action.type === 'valve_operation' && (
                    <Badge variant="outline" className="text-micro font-code h-4 border-orange-500/30 text-orange-500">
                      {step.action.target}%
                    </Badge>
                  )}
                </div>
              </div>

              {/* Drag handle for future drag-drop reordering */}
              <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="w-4 h-4 text-muted-foreground/50" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary stats */}
      <div className="mt-4 pt-3 border-t border-border">
        <div className="flex items-center justify-between text-tiny font-code text-muted-foreground">
          <span>
            {steps.filter((_, i) => getStepStatus(i) === 'completed').length}/{steps.length} étapes
          </span>
          <span>
            Durée totale: {formatTotalDuration(steps)}
          </span>
        </div>
      </div>
    </Card>
  );
}

function formatTotalDuration(steps: ProcedureStep[]): string {
  const totalSeconds = steps.reduce((sum, step) => sum + step.duration.value, 0);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}min`;
  return `${mins}min ${secs}s`;
}
