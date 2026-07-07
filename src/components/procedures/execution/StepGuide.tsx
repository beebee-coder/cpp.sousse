"use client";

import { ProcedureStep } from '@/lib/procedures/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  AlertTriangle, 
  Info, 
  Clock, 
  ShieldCheck,
  Play,
  RotateCcw,
  CheckCircle2,
  Settings2
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface StepGuideProps {
  step: ProcedureStep;
  onNext: () => void;
  onAlarm: (code: string) => void;
  onResolve: (code: string) => void;
  isAlarm: boolean;
  startTime: number;
}

export function StepGuide({ step, onNext, onAlarm, onResolve, isAlarm, startTime }: StepGuideProps) {
  const [elapsed, setElapsed] = useState(0);
  const duration = step.duration.value;
  const progress = Math.min(100, (elapsed / duration) * 100);
  const warnedRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  useEffect(() => {
    if (elapsed > step.validation.timeout.value && !isAlarm) {
      // onAlarm('TIMEOUT_EXCEEDED');
    }
  }, [elapsed, step, isAlarm, onAlarm]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (warnedRef.current) return;

    const preWarningAlarm = step.alarms?.find(a => a.type === 'warning' && typeof a.triggerBeforeEnd === 'number');
    if (!preWarningAlarm || typeof preWarningAlarm.triggerBeforeEnd !== 'number') return;

    const remaining = duration - elapsed;
    if (remaining <= preWarningAlarm.triggerBeforeEnd && !isAlarm) {
      warnedRef.current = true;

      const utterance = new SpeechSynthesisUtterance('Attention, phase bientôt finie.');
      utterance.lang = 'fr-FR';
      utterance.rate = 1.0;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }, [elapsed, duration, step.alarms, isAlarm]);

  return (
    <Card className={cn(
      "p-8 border-border transition-all duration-500",
      isAlarm ? "bg-destructive/5 border-destructive/50" : "bg-card/40"
    )}>
      {/* Step Header */}
      <div className="flex justify-between items-start mb-8">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
             <span className="w-8 h-8 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center text-xs font-bold text-primary font-code">
               {step.order}
             </span>
             <h3 className="text-2xl font-headline font-bold uppercase tracking-tight">{step.title}</h3>
          </div>
          {step.subtitle && <p className="text-muted-foreground font-code text-xs uppercase ml-11">{step.subtitle}</p>}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 px-3 py-1 bg-muted/20 border border-border rounded-sm">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-code font-bold">
              {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')} / {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <div className="w-32">
            <Progress value={progress} className="h-1 bg-muted" />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
        {/* Instructions */}
        <div className="md:col-span-2 space-y-6">
           <div className="p-6 bg-black/40 border border-border rounded-sm min-h-[160px] relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary group-hover:w-2 transition-all" />
              <p className="text-base sm:text-lg font-code leading-relaxed text-foreground/90">
                {step.description}
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Info className="w-4 h-4 text-primary opacity-50" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Directive de Sécurité S-101</span>
              </div>
           </div>

           {/* Actions / Buttons */}
           <div className="flex flex-wrap gap-4 pt-4">
              {step.action.type === 'confirmation' && (
                <Button 
                  onClick={onNext}
                  className="px-10 h-14 bg-secondary text-secondary-foreground font-bold uppercase text-sm shadow-[0_0_20px_rgba(46,184,146,0.3)] transition-all hover:scale-[1.02]"
                >
                  <CheckCircle2 className="w-5 h-5 mr-3" />
                  {step.action.ui.label}
                </Button>
              )}

              {step.action.type === 'valve_operation' && (
                <div className="flex items-center gap-4 p-2 bg-black/40 border border-primary/20 rounded-sm">
                   <Button onClick={onNext} className="bg-primary text-primary-foreground font-bold uppercase px-8 h-12">
                     <Settings2 className="w-4 h-4 mr-2" />
                     {step.action.ui.label}
                   </Button>
                   <div className="px-4">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">Cible</p>
                      <p className="text-xl font-code font-bold text-primary">{step.action.target}%</p>
                   </div>
                </div>
              )}

              <Button 
                variant="outline" 
                onClick={() => onAlarm('MANUAL_USER_ALERT')}
                className="h-14 border-destructive/30 text-destructive hover:bg-destructive/10 uppercase text-xs font-bold"
              >
                <AlertTriangle className="w-5 h-5 mr-2" />
                Signaler Anomalie
              </Button>
           </div>
        </div>

        {/* Media / Visual Aids */}
        <div className="space-y-4">
           <Card className="aspect-square bg-black border-border overflow-hidden relative group">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.4)_50%)] bg-[length:100%_4px] opacity-20 pointer-events-none z-10" />
              <div className="flex flex-col items-center justify-center h-full opacity-30 group-hover:opacity-60 transition-opacity">
                <ShieldCheck className="w-12 h-12 text-primary mb-2" />
                <span className="text-[10px] font-code uppercase">Ressource Visuelle</span>
              </div>
              <div className="absolute bottom-4 left-4 right-4 z-20">
                <Badge className="bg-primary/20 text-primary border-primary/40 uppercase text-[8px] font-bold">Ref: {step.id}-IMG</Badge>
              </div>
           </Card>

           <div className="p-3 bg-primary/5 border border-primary/20 rounded-sm">
              <p className="text-[9px] font-bold text-primary uppercase mb-2 flex items-center gap-2">
                <RotateCcw className="w-3 h-3" />
                Notes de maintenance
              </p>
              <ul className="space-y-1">
                <li className="text-[10px] font-code text-muted-foreground uppercase leading-tight">- Vérifier absence de fuite</li>
                <li className="text-[10px] font-code text-muted-foreground uppercase leading-tight">- Écouter bruits suspects</li>
              </ul>
           </div>
        </div>
      </div>

      {/* Validation Display */}
      {step.validation.conditions.length > 0 && (
        <div className="border-t border-border pt-6">
           <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4">Paramètres de Validation Temps Réel</h4>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
             {step.validation.conditions.map((cond) => (
               <div key={cond.id} className="flex items-center justify-between p-3 bg-black/40 border border-border rounded-sm">
                 <span className="text-[10px] font-code text-white/80 uppercase">{cond.displayName}</span>
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] font-code font-bold text-secondary">{cond.value} {cond.unit}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-secondary" />
                 </div>
               </div>
             ))}
           </div>
        </div>
      )}
    </Card>
  );
}
