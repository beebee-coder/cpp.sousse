"use client";

import { ProcedureStep } from '@/lib/procedures/types';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, Circle } from 'lucide-react';

interface ProcedureTimelineProps {
  steps: ProcedureStep[];
  currentStepIndex: number;
  completedSteps: string[];
}

export function ProcedureTimeline({ steps, currentStepIndex, completedSteps }: ProcedureTimelineProps) {
  return (
    <div className="w-full py-6">
      <div className="relative flex justify-between">
        {/* Ligne de fond */}
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-border -translate-y-1/2 z-0" />
        
        {/* Étapes */}
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = index === currentStepIndex;
          
          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center">
              <div className={cn(
                "w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-500 bg-background",
                isCompleted ? "border-secondary text-secondary bg-secondary/10" :
                isCurrent ? "border-primary text-primary animate-pulse scale-125 shadow-[0_0_15px_rgba(var(--primary),0.4)]" :
                "border-border text-muted-foreground"
              )}>
                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : 
                 isCurrent ? <Clock className="w-4 h-4" /> : 
                 <span className="text-[10px] font-bold font-code">{index + 1}</span>}
              </div>
              
              <div className="absolute top-10 w-24 text-center">
                 <p className={cn(
                   "text-[8px] font-headline font-bold uppercase tracking-widest leading-tight truncate",
                   isCurrent ? "text-primary" : "text-muted-foreground"
                 )}>
                   {step.title}
                 </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
