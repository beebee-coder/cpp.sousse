'use client';

import React from 'react';
import { useAppMode } from '@/hooks/use-app-mode';

interface ModeLayoutProps {
  children: React.ReactNode;
}

/**
 * Web Layout
 * - Thème bleu/cyan : sentiment cloud, moderne, connecté
 * - Navigation top bar
 * - Background: subtle gradient
 */
function WebLayout({ children }: ModeLayoutProps) {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Subtle animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-float-slow" />
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
}

/**
 * Hybrid Layout
 * - Thème pourpre/rose : sentiment de fusion, innovation, bridge
 * - Dual column potential
 * - Background: dynamic pattern
 */
function HybridLayout({ children }: ModeLayoutProps) {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-purple-900 to-slate-950">
      {/* Animated grid background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="url(#gradient-grid)" strokeWidth="0.5" />
            </pattern>
            <linearGradient id="gradient-grid" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgb(168, 85, 247)" />
              <stop offset="100%" stopColor="rgb(236, 72, 153)" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Floating orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-float-slow" />
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
}

/**
 * Local Layout
 * - Thème ambre/orange : sentiment d'autonomie, batterie, offline
 * - Compact/dense UI
 * - Background: warm, earthy
 */
function LocalLayout({ children }: ModeLayoutProps) {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-amber-900 to-slate-900">
      {/* Warm gradient overlay */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-900/20 to-amber-900/10" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
}

/**
 * Smart Layout Wrapper
 * Sélectionne automatiquement le layout selon le mode
 */
export function ModeLayout({ children }: ModeLayoutProps) {
  const { mode, isReady } = useAppMode();

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-slate-700 border-t-blue-500 rounded-full mx-auto mb-4" />
          <p className="text-slate-400">Initialisation...</p>
        </div>
      </div>
    );
  }

  switch (mode) {
    case 'web':
      return <WebLayout>{children}</WebLayout>;
    case 'hybride':
      return <HybridLayout>{children}</HybridLayout>;
    case 'locale':
      return <LocalLayout>{children}</LocalLayout>;
    default:
      return <WebLayout>{children}</WebLayout>;
  }
}
