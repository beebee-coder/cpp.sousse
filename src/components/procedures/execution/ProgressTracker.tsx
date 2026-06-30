"use client";

import { ProcedureStep } from '@/lib/procedures/types';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Circle, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressTrackerProps {
  steps: ProcedureStep[];
  currentStepIndex: number;
  completedSteps: string[];
}

export function ProgressTracker({ steps, currentStepIndex, completedSteps }: ProgressTrackerProps) {
  return (
    <Card className="p-4 border-border bg-black/40 h-full overflow-y-auto terminal-scroll">
      <div className="flex items-center gap-2 mb-6">
        <Zap className="w-4 h-4 text-primary" />
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Séquence du Registre</h4>
      </div>

      <div className="relative pl-4 space-y-8">
        {/* Ligne verticale de connexion */}
        <div className="absolute left-[23px] top-4 bottom-4 w-px bg-border/50" />

        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = index === currentStepIndex;
          const isFuture = index > currentStepIndex;

          return (
            <div key={step.id} className="relative flex items-start gap-6 group">
              {/* Dot / Icon */}
              <div className={cn(
                "relative z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 bg-background",
                isCompleted ? "border-secondary bg-secondary/20 text-secondary" :
                isCurrent ? "border-primary bg-primary/20 scale-110 text-primary shadow-[0_0_10px_rgba(50,181,212,0.3)]" :
                "border-border text-muted-foreground"
              )}>
                {isCompleted ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : isCurrent ? (
                  <Clock className="w-3 h-3 animate-spin-slow" />
                ) : (
                  <span className="text-[8px] font-bold">{index + 1}</span>
                )}
              </div>

              {/* Text */}
              <div className="min-w-0">
                <p className={cn(
                  "text-[10px] font-headline font-bold uppercase tracking-wide truncate transition-colors",
                  isCurrent ? "text-primary" : isCompleted ? "text-secondary" : "text-muted-foreground"
                )}>
                  {step.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                   <span className="text-[8px] font-code text-muted-foreground uppercase">{step.duration.display}</span>
                   {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
