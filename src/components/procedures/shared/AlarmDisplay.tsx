"use client";

import { StepAlarm } from '@/lib/procedures/types';
import { AlertTriangle, ShieldAlert, Clock, Hammer, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AlarmDisplayProps {
  alarm: StepAlarm;
  onResolve: (code: string) => void;
}

export function AlarmDisplay({ alarm, onResolve }: AlarmDisplayProps) {
  return (
    <Card className="border-destructive bg-destructive/5 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="bg-destructive/10 p-4 flex items-center justify-between border-b border-destructive/20">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-destructive animate-pulse" />
          <div>
            <p className="text-[10px] font-bold text-destructive uppercase tracking-widest leading-none">ALERTE_CRITIQUE_DETECTEE</p>
            <h4 className="text-sm font-headline font-bold uppercase text-white">{alarm.code}</h4>
          </div>
        </div>
        <div className="px-2 py-1 bg-destructive/20 border border-destructive/40 rounded-sm">
          <span className="text-[9px] font-code font-bold text-destructive uppercase">{alarm.severity}</span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <p className="text-sm font-code text-foreground/90 leading-relaxed uppercase">
          {alarm.description}
        </p>

        {/* Remède / Action corrective */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Hammer className="w-4 h-4 text-secondary" />
            <h5 className="text-[10px] font-bold uppercase tracking-widest text-secondary">Protocole de Résolution</h5>
          </div>
          
          <div className="p-4 bg-black/40 border border-secondary/20 rounded-sm">
            <p className="text-xs font-bold text-secondary uppercase mb-3">{alarm.remedy.title}</p>
            <ol className="space-y-2">
              {alarm.remedy.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-[10px] font-code text-muted-foreground uppercase">
                  <span className="text-secondary font-bold">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-sm">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] font-code uppercase">TTR : {alarm.remedy.estimatedTime}s</span>
            </div>
            <Button 
              onClick={() => onResolve(alarm.code)}
              className="bg-secondary text-secondary-foreground font-bold uppercase text-[10px] h-10 shadow-lg"
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              Confirmer Résolution
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
