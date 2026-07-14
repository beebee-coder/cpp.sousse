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
    let cancelled = false;

    async function checkHealth() {
    try {
      if (service === 'GROQ') {
        const res = await fetch('/api/health/groq', {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
          signal: AbortSignal.timeout(5000),
        });
        if (!cancelled) {
          setStatus(res.ok ? 'online' : 'offline');
        }
        return;
      }

      if (service === 'GEMINI') {
        const res = await fetch('/api/health/gemini', {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
          signal: AbortSignal.timeout(5000),
        });
        if (!cancelled) {
          setStatus(res.ok ? 'online' : 'offline');
        }
        return;
      }

      if (service === 'GITHUB') {
        const res = await fetch('https://api.github.com', {
          method: 'HEAD',
          headers: { 'Cache-Control': 'no-cache' },
          signal: AbortSignal.timeout(5000),
        });
        if (!cancelled) {
          setStatus(res.ok ? 'online' : 'offline');
        }
        return;
      }

      if (service === 'FIREBASE') {
        const res = await fetch('/api/health/firebase', {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
          signal: AbortSignal.timeout(5000),
        });
        if (!cancelled) {
          setStatus(res.ok ? 'online' : 'offline');
        }
        return;
      }

      if (!cancelled) setStatus('online');
    } catch {
      if (!cancelled) setStatus('offline');
    }
    }

    checkHealth();
    return () => { cancelled = true; };
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
          {status === 'online' ? 'Liaison Active' : status === 'offline' ? 'Hors Ligne' : 'Vérification...'}
        </span>
        {status === 'online' ? (
          <Wifi className="w-2.5 h-2.5 text-secondary animate-pulse" />
        ) : status === 'offline' ? (
          <WifiOff className="w-2.5 h-2.5 text-muted-foreground" />
        ) : (
          <Globe className="w-2.5 h-2.5 text-muted-foreground animate-spin" />
        )}
      </div>
    </div>
  );
}
