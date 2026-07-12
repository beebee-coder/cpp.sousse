'use client';

import React from 'react';
import { ModeLiveIndicator, ModeContextMenu, ModeNotification } from './ModeLiveIndicator';
import { useAppMode } from '@/hooks/use-app-mode';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Mode Status Widget for Sidebar/Footer
 * Displays current mode with interactive dropdown
 */
export function ModeStatusWidget() {
  const { isReady } = useAppMode();

  if (!isReady) {
    return null;
  }

  return (
    <>
      {/* Mode Notification Toast */}
      <ModeNotification />

      {/* Mode Status Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors text-sm">
            <ModeLiveIndicator variant="minimal" />
            <span className="text-slate-400 hover:text-slate-300 text-xs">Mode</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-48">
          <div className="p-3">
            <ModeContextMenu />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

/**
 * Simple inline mode badge for any location
 */
export function ModeInline() {
  return (
    <div className="inline-flex items-center gap-2">
      <ModeLiveIndicator variant="full" />
    </div>
  );
}
