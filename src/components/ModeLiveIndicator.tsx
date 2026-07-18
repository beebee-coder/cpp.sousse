'use client';

import React from 'react';
import { useAppMode } from '@/hooks/use-app-mode';
import { cn } from '@/lib/utils';

interface ModeLiveIndicatorProps {
  className?: string;
  variant?: 'minimal' | 'full';
}

/**
 * Live Mode Indicator for Headers/Navbars
 * Minimal: Just the badge
 * Full: Badge + connection status
 */
export function ModeLiveIndicator({ className, variant = 'minimal' }: ModeLiveIndicatorProps) {
  const { mode, online, isReady } = useAppMode();

  if (!isReady) {
    return (
      <div className={cn('h-6 w-6 rounded-full bg-slate-700 animate-pulse', className)} />
    );
  }

  const modeConfig = {
    web: {
      icon: '☁️',
      label: 'Web',
      color: 'from-blue-500 to-cyan-400',
      glow: 'shadow-blue-500/50',
    },
    hybride: {
      icon: '🔗',
      label: 'Hybride',
      color: 'from-purple-500 to-pink-400',
      glow: 'shadow-purple-500/50',
    },
    locale: {
      icon: '⚡',
      label: 'Offline',
      color: 'from-amber-500 to-orange-400',
      glow: 'shadow-amber-500/50',
    },
  };

  const config = modeConfig[mode];

  if (variant === 'minimal') {
    return (
      <div className={cn('inline-flex items-center justify-center w-6 h-6', className)}>
        <span className="text-sm">{config.icon}</span>
      </div>
    );
  }

  return (
    <div className={cn('inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r', config.color, 'shadow-lg', config.glow, 'text-white text-xs font-semibold', className)}>
      <span className="w-2 h-2 rounded-full bg-white" />
      <span>{config.label}</span>
      {mode === 'hybride' && (
        <span className={cn('ml-1 text-xs', online ? 'text-green-200' : 'text-red-200')}>
          {online ? '🟢' : '🔴'}
        </span>
      )}
    </div>
  );
}

/**
 * Mode-aware context menu / dropdown
 */
export function ModeContextMenu() {
  const { mode, online, isDesktop, isReady } = useAppMode();

  if (!isReady) return null;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/90 p-3 space-y-2 text-sm">
      <div className="font-semibold text-white capitalize">Mode: {mode}</div>
      
      <div className="space-y-1 text-xs text-slate-400">
        <div>Desktop: {isDesktop ? 'Oui' : 'Non'}</div>
        <div>Online: {online ? 'Oui 🟢' : 'Non 🔴'}</div>
      </div>
    </div>
  );
}

/**
 * Mode-aware toast/notification
 */
export function ModeNotification() {
  const { mode, online, isReady } = useAppMode();

  if (!isReady || mode === 'web') return null;

  if (mode === 'locale') {
    return (
      <div className="fixed bottom-4 left-4 max-w-xs bg-amber-900/90 border border-amber-700 rounded-lg p-4 text-sm text-amber-100">
        <div className="flex items-start gap-3">
          <span className="text-lg">⚡</span>
          <div>
            <div className="font-semibold">Mode Offline Actif</div>
            <p className="text-xs text-amber-200 mt-1">
              Vous travaillez hors ligne. Les changements seront synchronisés lorsque la connexion sera rétablie.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'hybride' && !online) {
    return (
      <div className="fixed bottom-4 left-4 max-w-xs bg-purple-900/90 border border-purple-700 rounded-lg p-4 text-sm text-purple-100">
        <div className="flex items-start gap-3">
          <span className="text-lg">🔗</span>
          <div>
            <div className="font-semibold">Mode Hybride - Offline</div>
            <p className="text-xs text-purple-200 mt-1">
              Utilisant le cache local. La synchronisation reprendra dès que possible.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
