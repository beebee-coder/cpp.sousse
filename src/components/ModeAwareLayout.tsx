'use client';

import React from 'react';
import { ModeLayout } from './ModeLayout';
import { ModeBadge } from './ModeIndicator';

interface ModeAwareLayoutProps {
  children: React.ReactNode;
  showBadge?: boolean;
}

/**
 * Mode-Aware Root Layout
 * Intègre automatiquement :
 * 1. La détection du mode (web/hybride/locale)
 * 2. Le thème visuel correspondant (via ModeLayout)
 * 3. Le badge indicateur du mode
 */
export function ModeAwareLayout({ children, showBadge = true }: ModeAwareLayoutProps) {
  return (
    <ModeLayout showModeIndicator={showBadge}>
      {children}
    </ModeLayout>
  );
}
