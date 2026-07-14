"use client";

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AlarmModalProps {
  alarm: {
    code: string;
    description: string;
    remedy: {
      title: string;
      description: string;
      steps: string[];
      tools?: string[];
      safety?: string[];
    };
  };
  onResolve: () => void;
  onClose: () => void;
}

export function AlarmModal({ alarm, onResolve, onClose }: AlarmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full p-6 bg-destructive/10 border-destructive/50 space-y-4">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-8 h-8 text-destructive shrink-0" />
          <div>
            <h3 className="text-lg font-headline font-bold text-destructive uppercase">{alarm.code}</h3>
            <p className="text-sm font-code text-destructive/90">{alarm.description}</p>
          </div>
        </div>

        <div className="p-4 terminal-card space-y-3">
          <h4 className="text-xs font-bold text-white uppercase">{alarm.remedy.title}</h4>
          <p className="text-xs text-muted-foreground">{alarm.remedy.description}</p>
          <ol className="list-decimal list-inside space-y-1">
            {alarm.remedy.steps.map((step, idx) => (
              <li key={idx} className="text-xs font-code text-white/80">{step}</li>
            ))}
          </ol>
          {alarm.remedy.tools && alarm.remedy.tools.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {alarm.remedy.tools.map((tool) => (
                <Badge key={tool} variant="outline" className="text-micro font-code">{tool}</Badge>
              ))}
            </div>
          )}
          {alarm.remedy.safety && alarm.remedy.safety.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {alarm.remedy.safety.map((safety) => (
                <Badge key={safety} variant="outline" className="text-micro font-code border-orange-500/30 text-orange-500">
                  {safety}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="uppercase text-xs">
            Fermer
          </Button>
          <Button onClick={onResolve} className="bg-secondary text-secondary-foreground uppercase text-xs">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Problème Résolu
          </Button>
        </div>
      </Card>
    </div>
  );
}
