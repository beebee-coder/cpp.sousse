"use client";

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';

export interface AbortedStageProps {
  stepReport: Array<{
    title: string;
    duration: number;
  }>;
  formatDuration: (seconds: number) => string;
  onRestart: () => void;
}

export function AbortedStage({ stepReport, formatDuration, onRestart }: AbortedStageProps) {
  const t = useTranslation();
  return (
    <Card className="p-8 danger-card text-center space-y-4">
      <AlertTriangle className="w-16 h-16 text-destructive mx-auto" />
      <h2 className="text-xl font-headline font-bold uppercase text-destructive">{t('aborted.title')}</h2>
      <p className="text-sm text-muted-foreground font-code max-w-md mx-auto">
        {t('aborted.subtitle')}
      </p>
      {stepReport.length > 0 && (
        <div className="pt-4 text-left max-w-md mx-auto">
          <h3 className="text-tiny font-bold text-muted-foreground uppercase tracking-widest mb-2">{t('aborted.completedSteps')}</h3>
          <div className="space-y-1">
            {stepReport.map((report, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-black/20 rounded-sm">
                <span className="text-xs font-code">{report.title}</span>
                <Badge variant="outline" className="text-micro font-code">
                  {formatDuration(report.duration)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="pt-4">
        <Button onClick={onRestart} variant="outline" className="uppercase text-xs">
          <RotateCcw className="w-4 h-4 mr-2" />
                    {t('aborted.reset')}
        </Button>
      </div>
    </Card>
  );
}
