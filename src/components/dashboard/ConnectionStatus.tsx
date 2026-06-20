
"use client";

import { Globe, Wifi, WifiOff, Cloud, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface ConnectionStatusProps {
  service: 'GROQ' | 'GEMINI' | 'GITHUB' | 'FIREBASE';
  label: string;
}

export function ConnectionStatus({ service, label }: ConnectionStatusProps) {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    // Simulation d'un check de santé du service
    // En production, cela pourrait appeler un endpoint de santé
    const timer = setTimeout(() => {
      setStatus('online');
    }, 1500);
    return () => clearTimeout(timer);
  }, [service]);

  return (
    <div className="flex items-center justify-between p-2 border border-border bg-background/40 rounded-sm">
      <div className="flex items-center gap-2">
        <Cloud className={cn(
          "w-3 h-3",
          status === 'online' ? "text-secondary" : "text-muted-foreground"
        )} />
        <span className="text-[10px] font-code text-muted-foreground uppercase">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={cn(
          "text-[9px] font-bold uppercase font-code px-1.5 py-0.5 rounded-sm",
          status === 'online' ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"
        )}>
          {status === 'online' ? 'Liaison Active' : 'Vérification...'}
        </span>
        {status === 'online' ? (
          <Wifi className="w-2.5 h-2.5 text-secondary animate-pulse" />
        ) : (
          <WifiOff className="w-2.5 h-2.5 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
