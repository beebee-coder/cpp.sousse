'use client';

import React from 'react';
import { ModeLayout } from './ModeLayout';

interface ModeAwareLayoutProps {
  children: React.ReactNode;
}

/**
 * Mode-Aware Root Layout
 * Intègre automatiquement :
 * 1. La détection du mode (web/hybride/locale)
 * 2. Le thème visuel correspondant (via ModeLayout)
 * 3. Le badge indicateur du mode (badge global en bas à droite, voir AppChrome)
 */
export function ModeAwareLayout({ children }: ModeAwareLayoutProps) {
  return (
    <ModeLayout>
      {children}
    </ModeLayout>
  );
}
