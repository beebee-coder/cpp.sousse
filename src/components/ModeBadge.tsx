'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Globe,
  Layers,
  HardDrive,
  ChevronDown,
  Check,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppMode, type AppMode } from '@/hooks/use-app-mode';

interface ModeStyle {
  label: string;
  sub: string;
  Icon: typeof Globe;
  ring: string;
  glow: string;
  text: string;
  dot: string;
  chip: string;
}

const MODE_CONFIG: Record<AppMode, ModeStyle> = {
  web: {
    label: 'WEB',
    sub: 'Cloud Vercel',
    Icon: Globe,
    ring: 'from-sky-400/80 via-cyan-400/60 to-primary/70',
    glow: 'shadow-[0_0_20px_-3px_rgba(56,189,248,0.55)]',
    text: 'text-sky-200',
    dot: 'bg-sky-300',
    chip: 'bg-sky-400/10 border-sky-300/30',
  },
  hybride: {
    label: 'HYBRIDE',
    sub: 'Locale + Cloud',
    Icon: Layers,
    ring: 'from-violet-400/80 via-fuchsia-400/60 to-primary/70',
    glow: 'shadow-[0_0_20px_-3px_rgba(167,139,250,0.55)]',
    text: 'text-violet-200',
    dot: 'bg-violet-300',
    chip: 'bg-violet-400/10 border-violet-300/30',
  },
  locale: {
    label: 'LOCALE',
    sub: 'Hors-ligne',
    Icon: HardDrive,
    ring: 'from-emerald-400/80 via-secondary/60 to-emerald-500/70',
    glow: 'shadow-[0_0_20px_-3px_rgba(52,211,153,0.55)]',
    text: 'text-emerald-200',
    dot: 'bg-emerald-300',
    chip: 'bg-emerald-400/10 border-emerald-300/30',
  },
};

export function ModeBadge() {
  const { mode, isDesktop, online, localOnly, setLocalOnly } = useAppMode();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cfg = MODE_CONFIG[mode];
  const { Icon } = cfg;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Mode actuel : ${cfg.label}. Cliquer pour changer.`}
        className="w-full group focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-lg"
      >
        <div className={cn('rounded-lg p-[1.5px] bg-gradient-to-r transition-all', cfg.ring, cfg.glow)}>
          <div className="rounded-[6.5px] bg-card/85 backdrop-blur px-3 py-2.5 flex items-center gap-3">
            <span className={cn('relative flex items-center justify-center w-9 h-9 rounded-md border shrink-0', cfg.chip)}>
              <Icon className={cn('w-4 h-4', cfg.text)} />
              <span
                className={cn(
                  'absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-card animate-pulse',
                  cfg.dot
                )}
              />
            </span>

            <div className="flex-1 min-w-0 text-left">
              <div className={cn('text-[12px] font-headline font-bold uppercase tracking-[0.18em] leading-none', cfg.text)}>
                {cfg.label}
              </div>
              <div className="text-[9px] font-code uppercase text-muted-foreground/80 truncate mt-0.5">
                {cfg.sub}
              </div>
            </div>

            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-foreground transition-transform',
                open && 'rotate-180'
              )}
            />
          </div>
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-lg border border-border bg-popover/95 backdrop-blur p-1.5 shadow-glow animate-fade-up">
          <p className="px-2 py-1 text-[9px] font-code uppercase tracking-widest text-muted-foreground/70">
            Stratégie de connexion
          </p>

          <button
            type="button"
            onClick={() => {
              setLocalOnly(false);
              setOpen(false);
            }}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-2 rounded-md text-left transition-colors',
              !localOnly ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60 text-foreground'
            )}
          >
            <Wifi className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-[10px] font-bold uppercase tracking-widest">Auto (selon connexion)</span>
            {!localOnly && <Check className="w-3.5 h-3.5 shrink-0" />}
          </button>

          <button
            type="button"
            disabled={!isDesktop}
            onClick={() => {
              if (!isDesktop) return;
              setLocalOnly(true);
              setOpen(false);
            }}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-2 rounded-md text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              localOnly ? 'bg-secondary/10 text-secondary' : 'hover:bg-muted/60 text-foreground'
            )}
          >
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-[10px] font-bold uppercase tracking-widest">
              Locale uniquement
            </span>
            {localOnly && <Check className="w-3.5 h-3.5 shrink-0" />}
          </button>

          {!isDesktop && (
            <p className="px-2 pt-1 text-[8px] font-code uppercase text-muted-foreground/60 leading-tight">
              Disponible sur l'application installée (Tauri).
            </p>
          )}
          {!online && isDesktop && (
            <p className="px-2 pt-1 text-[8px] font-code uppercase text-destructive/80 leading-tight">
              Aucune connexion détectée.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
