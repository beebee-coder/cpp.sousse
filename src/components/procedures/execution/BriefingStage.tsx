"use client";

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/use-translation';

export interface BriefingStageProps {
  procedure: {
    metadata: {
      title: string;
      code: string;
      criticality: string;
    };
    steps: Array<{
      description: string;
      duration: { value: number };
      alarms?: Array<{ remedy?: { safety?: string[] } }>;
      notes?: string[];
    }>;
    prerequisites: {
      items: Array<{ displayName: string }>;
    };
  };
  getCriticalityColor: (criticality: string) => string;
  onContinue: () => void;
}

export function BriefingStage({ procedure, getCriticalityColor, onContinue }: BriefingStageProps) {
  const t = useTranslation();
  const totalAlarms = procedure.steps.reduce((sum, s) => sum + (s.alarms?.length || 0), 0);
  const safetyItems = Array.from(new Set(
    procedure.steps.flatMap(s => s.alarms?.flatMap(a => a.remedy?.safety || []) || [])
  ));
  const hasVigilancePoints = procedure.steps.some(s => s.notes && s.notes.length > 0);

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2 mb-8">
          <ShieldCheck className="w-12 h-12 text-primary mx-auto" />
          <h2 className="text-lg font-headline font-bold uppercase">{t('briefing.title')}</h2>
          <p className="text-xs text-muted-foreground font-code">{t('briefing.subtitle')}</p>
        </div>

        <Card className="p-6 terminal-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-primary uppercase tracking-widest">{t('briefing.objective')}</h3>
              <p className="text-xs font-code text-muted-foreground mt-1">{procedure.steps[0]?.description || t('briefing.procedureObjective', '')}</p>
            </div>
            <Badge variant="outline" className={cn("text-micro font-code uppercase", getCriticalityColor(procedure.metadata.criticality))}>
              {procedure.metadata.criticality}
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border">
            <div className="text-center">
              <p className="text-micro font-bold text-muted-foreground uppercase tracking-widest">{t('briefing.totalDuration')}</p>
              <p className="text-sm font-code font-bold text-white mt-1">
                {procedure.steps.reduce((sum, s) => sum + s.duration.value, 0)}s
              </p>
            </div>
            <div className="text-center">
              <p className="text-micro font-bold text-muted-foreground uppercase tracking-widest">{t('briefing.stepCount')}</p>
              <p className="text-sm font-code font-bold text-white mt-1">{procedure.steps.length}</p>
            </div>
            <div className="text-center">
              <p className="text-micro font-bold text-muted-foreground uppercase tracking-widest">{t('common.prerequisites')}</p>
              <p className="text-sm font-code font-bold text-white mt-1">{procedure.prerequisites.items.length}</p>
            </div>
            <div className="text-center">
              <p className="text-micro font-bold text-muted-foreground uppercase tracking-widest">{t('common.alarms')}</p>
              <p className="text-sm font-code font-bold text-white mt-1">{totalAlarms}</p>
            </div>
          </div>

          {hasVigilancePoints && (
            <div className="pt-4 border-t border-border">
              <h4 className="text-tiny font-bold text-muted-foreground uppercase tracking-widest mb-2">{t('briefing.vigilancePoints')}</h4>
              <ul className="space-y-1">
                {procedure.steps.filter(s => s.notes?.length).slice(0, 3).map((step, idx) => (
                  <li key={idx} className="text-[10px] font-code text-white/80 flex items-start gap-2">
                    <span className="text-primary mt-0.5">▸</span>
                    <span><strong>{step.description}:</strong> {step.notes?.slice(0, 2).join(' | ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {safetyItems.length > 0 && (
            <div className="pt-4 border-t border-border">
               <h4 className="text-tiny font-bold text-destructive uppercase tracking-widest mb-2">{t('briefing.requiredPPE')}</h4>
              <div className="flex flex-wrap gap-2">
                {safetyItems.map((safety, idx) => (
                  <Badge key={idx} variant="outline" className="text-micro font-code border-orange-500/30 text-orange-500">
                    {safety}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>

        <div className="pt-6 flex justify-center">
          <Button
            size="lg"
            onClick={onContinue}
            className="px-12 h-14 bg-secondary text-secondary-foreground font-bold uppercase text-sm shadow-[0_0_30px_rgba(46,184,146,0.4)] hover:scale-[1.02] transition-all"
          >
            <ShieldCheck className="w-5 h-5 mr-3" />
            {t('guide.verifyPrerequisites')}
          </Button>
        </div>
      </div>
    </div>
  );
}
