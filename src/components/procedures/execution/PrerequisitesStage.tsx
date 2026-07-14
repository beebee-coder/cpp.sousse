"use client";

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/use-translation';

export interface PrerequisitesStageProps {
  prerequisites: {
    items: Array<{
      id: string;
      displayName: string;
      description: string;
      verificationType: string;
      threshold?: number | string;
      unit?: string;
      condition?: string;
      sensorRef?: string;
      manualCheckInstruction?: string;
    }>;
  };
  autoChecking: boolean;
  checkResults: Record<string, boolean>;
  confirmedPrerequisites: Set<string>;
  onTogglePrerequisite: (id: string) => void;
  onStartProcedure: () => void;
  speak: (text: string) => void;
}

export function PrerequisitesStage({
  prerequisites,
  autoChecking,
  checkResults,
  confirmedPrerequisites,
  onTogglePrerequisite,
  onStartProcedure,
  speak
}: PrerequisitesStageProps) {
  const t = useTranslation();
  const [localCheckResults, setLocalCheckResults] = useState<Record<string, boolean>>({});
  const [localAutoChecking, setLocalAutoChecking] = useState(false);

  useEffect(() => {
    setLocalCheckResults(checkResults);
    setLocalAutoChecking(autoChecking);
  }, [checkResults, autoChecking]);

  const allPrerequisitesMet = () => {
    return prerequisites.items.every(prereq => {
      if (prereq.verificationType === 'automatic') {
        return localCheckResults[prereq.id] === true;
      }
      return confirmedPrerequisites.has(prereq.id);
    });
  };

  const unmetPrerequisites = prerequisites.items.filter(prereq => {
    if (prereq.verificationType === 'automatic') {
      return localCheckResults[prereq.id] !== true;
    }
    return !confirmedPrerequisites.has(prereq.id);
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2 mb-8">
          <ShieldCheck className="w-12 h-12 text-primary mx-auto" />
          <h2 className="text-lg font-headline font-bold uppercase">{t('prerequisites.title')}</h2>
          <p className="text-xs text-muted-foreground font-code">{t('prerequisites.checkConditions')}</p>
        </div>

        {localAutoChecking && (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-sm">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-code text-primary uppercase">{t('prerequisites.automaticCheck')}</span>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {prerequisites.items.map((prereq) => {
            const autoChecked = prereq.verificationType === 'automatic';
            const isChecked = autoChecked ? localCheckResults[prereq.id] === true : confirmedPrerequisites.has(prereq.id);
            const isChecking = autoChecked && !localCheckResults[prereq.id];

            return (
              <Card
                key={prereq.id}
                className={cn(
                  "p-4 border transition-all",
                  isChecked
                    ? "bg-secondary/10 border-secondary/40"
                    : localAutoChecking
                    ? "panel-card opacity-60"
                    : "panel-card hover:border-primary/40"
                )}
                onClick={() => {
                  if (!autoChecked) {
                    onTogglePrerequisite(prereq.id);
                    speak(`Prérequis confirmé : ${prereq.displayName}`);
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
                        "text-micro font-code h-4",
                        isChecked ? "border-secondary/40 text-secondary" : "border-muted-foreground/30 text-muted-foreground"
                      )}>
                        {prereq.verificationType}
                      </Badge>
                    </div>
                    <p className="text-2xs font-code text-muted-foreground mb-2">{prereq.description}</p>
                    {(prereq.threshold !== undefined || prereq.unit || prereq.condition) && (
                      <div className="flex items-center gap-3 mb-2">
                        {prereq.condition && (
                          <span className="text-tiny font-code text-primary/80 bg-primary/10 px-2 py-0.5 rounded-sm">
                            {prereq.condition}
                          </span>
                        )}
                        {prereq.threshold !== undefined && (
                          <span className="text-tiny font-code text-white/70">
                            Seuil: {prereq.threshold} {prereq.unit || ''}
                          </span>
                        )}
                      </div>
                    )}
                    {prereq.sensorRef && (
                      <p className="text-tiny font-code text-primary/70">
                        Capteur: {prereq.sensorRef}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {unmetPrerequisites.length > 0 && (
          <Card className="p-4 danger-card">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-destructive uppercase mb-1">{t('prerequisites.prerequisitesNotMet')}</p>
                <p className="text-2xs font-code text-muted-foreground">
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
            onClick={onStartProcedure}
            className="px-12 h-14 bg-secondary text-secondary-foreground font-bold uppercase text-sm shadow-[0_0_30px_rgba(46,184,146,0.4)] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShieldCheck className="w-5 h-5 mr-3" />
            {t('guide.startProcedure')}
          </Button>
        </div>
      </div>
    </div>
  );
}
