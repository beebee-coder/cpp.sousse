"use client";

import { CheckCircle2, AlertCircle, Clock, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ValidationBadgeProps {
  status: 'VALIDATED' | 'FAILED' | 'PENDING' | 'MONITORING';
  label: string;
  value?: string;
  className?: string;
}

export function ValidationBadge({ status, label, value, className }: ValidationBadgeProps) {
  const configs: Record<ValidationBadgeProps['status'], { color: string; bg: string; border: string; icon: any; animate?: string }> = {
    VALIDATED: { color: 'text-secondary', bg: 'bg-secondary/10', border: 'border-secondary/30', icon: CheckCircle2 },
    FAILED: { color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30', icon: AlertCircle },
    PENDING: { color: 'text-muted-foreground', bg: 'bg-muted/10', border: 'border-muted/30', icon: Clock },
    MONITORING: { color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30', icon: Search, animate: 'animate-pulse' }
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 border rounded-sm transition-all",
      config.bg, config.border, className
    )}>
      <Icon className={cn("w-3.5 h-3.5", config.color, config.animate)} />
      <div className="flex flex-col">
        <span className={cn("text-[8px] font-bold uppercase tracking-widest", config.color)}>{label}</span>
        {value && <span className="text-[10px] font-code font-bold text-white uppercase">{value}</span>}
      </div>
    </div>
  );
}
