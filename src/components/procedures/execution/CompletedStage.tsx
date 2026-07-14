"use client";

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/use-translation';

export interface CompletedStageProps {
  procedure: {
    metadata: {
      title: string;
      code: string;
    };
    postExecution?: {
      checks: Array<{
        id: string;
        description: string;
        condition?: string;
        interval?: number;
      }>;
    };
  };
  stepReport: Array<{
    stepId: string;
    title: string;
    duration: number;
    status: 'completed' | 'skipped' | 'timeout';
    alarms?: string[];
  }>;
  formatDuration: (seconds: number) => string;
  onRestart: () => void;
  onExportJson: () => void;
  onPrint: () => void;
}

export function CompletedStage({
  procedure,
  stepReport,
  formatDuration,
  onRestart,
  onExportJson,
  onPrint
}: CompletedStageProps) {
  const t = useTranslation();
  const totalDuration = stepReport.reduce((sum, r) => sum + r.duration, 0);

  return (
    <Card className="p-8 panel-card space-y-6">
      <div className="text-center space-y-4">
        <CheckCircle2 className="w-16 h-16 text-secondary mx-auto" />
        <h2 className="text-xl font-headline font-bold uppercase text-secondary">{t('completed.title')}</h2>
        <p className="text-sm text-muted-foreground font-code max-w-md mx-auto">
          {t('completed.subtitle')}
        </p>
      </div>

      {stepReport.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-2xs font-bold text-muted-foreground uppercase tracking-widest px-2">{t('completed.executionReport')}</h3>
          <div className="max-h-40 overflow-y-auto space-y-2">
            {stepReport.map((report, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-black/20 rounded-sm">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-micro font-code h-4">
                    Étape {idx + 1}
                  </Badge>
                  <span className="text-xs font-code text-white/80">{report.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xs font-code text-muted-foreground">
                    {formatDuration(report.duration)}
                  </span>
                  <Badge variant="outline" className={cn(
                    "text-micro font-code h-4",
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

      {stepReport.some(r => r.alarms && r.alarms.length > 0) && (
        <div className="space-y-3">
          <h3 className="text-2xs font-bold text-destructive uppercase tracking-widest px-2">{t('completed.triggeredAlarms')}</h3>
          <div className="space-y-2">
            {stepReport.filter(r => r.alarms?.length).map((report, idx) => (
              <div key={idx} className="p-2 bg-destructive/10 border border-destructive/20 rounded-sm">
                <span className="text-2xs font-code text-white/80">{report.title}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {report.alarms?.map((alarm, i) => (
                    <Badge key={i} variant="outline" className="text-micro font-code border-destructive/30 text-destructive">
                      {alarm}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border">
        <div className="text-center">
          <p className="text-micro font-bold text-muted-foreground uppercase tracking-widest">{t('completed.totalDuration')}</p>
          <p className="text-sm font-code font-bold text-white mt-1">
            {formatDuration(totalDuration)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-micro font-bold text-muted-foreground uppercase tracking-widest">{t('completed.completed')}</p>
          <p className="text-sm font-code font-bold text-secondary mt-1">
            {stepReport.filter(r => r.status === 'completed').length}/{stepReport.length}
          </p>
        </div>
        <div className="text-center">
          <p className="text-micro font-bold text-muted-foreground uppercase tracking-widest">{t('completed.skipped')}</p>
          <p className="text-sm font-code font-bold text-orange-500 mt-1">
            {stepReport.filter(r => r.status === 'skipped').length}
          </p>
        </div>
        <div className="text-center">
          <p className="text-micro font-bold text-muted-foreground uppercase tracking-widest">{t('completed.timeouts')}</p>
          <p className="text-sm font-code font-bold text-destructive mt-1">
            {stepReport.filter(r => r.status === 'timeout').length}
          </p>
        </div>
      </div>

      {procedure.postExecution?.checks && (
        <div className="space-y-3">
          <h3 className="text-2xs font-bold text-muted-foreground uppercase tracking-widest">{t('completed.postExecutionChecks')}</h3>
          <div className="space-y-2">
            {procedure.postExecution.checks.map((check) => (
              <div key={check.id} className="flex items-start gap-2 p-3 bg-black/20 rounded-sm">
                <CheckCircle2 className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
                <div className="flex-1">
                  <span className="text-xs font-code text-left">{check.description}</span>
                  <div className="flex items-center gap-3 mt-1">
                    {check.condition && (
                      <span className="text-tiny font-code text-primary/80 bg-primary/10 px-2 py-0.5 rounded-sm">
                        {check.condition}
                      </span>
                    )}
                    {check.interval && (
                      <span className="text-tiny font-code text-muted-foreground">
                        {t('completed.interval')}: {check.interval}s
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-4 flex justify-center gap-3">
        <Button onClick={onRestart} className="uppercase text-xs">
          <RotateCcw className="w-4 h-4 mr-2" />
          {t('completed.restart')}
        </Button>
        <Button variant="outline" onClick={onExportJson} className="uppercase text-xs">
          <ShieldCheck className="w-4 h-4 mr-2" />
          {t('completed.exportJson')}
        </Button>
        <Button variant="outline" onClick={onPrint} className="uppercase text-xs">
          {t('completed.printReport')}
        </Button>
      </div>
    </Card>
  );
}
