'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getPlatformInfo, type PlatformCapabilities, type PlatformType } from '@/lib/platform';

interface PlatformContextType {
  isDesktop: boolean;
  platform: PlatformType;
  capabilities: PlatformCapabilities[];
  isReady: boolean;
}

interface PlatformProviderProps {
  children: React.ReactNode;
  initialIsDesktop?: boolean;
}

const PlatformContext = createContext<PlatformContextType | undefined>(undefined);

export function PlatformProvider({ children, initialIsDesktop = false }: PlatformProviderProps) {
  const [platformData, setPlatformData] = useState<PlatformContextType>({
    isDesktop: initialIsDesktop,
    platform: initialIsDesktop ? 'Tauri Natif' : 'Vercel Web',
    capabilities: [],
    isReady: false,
  });

  useEffect(() => {
    const info = getPlatformInfo();
    setPlatformData({
      ...info,
      isReady: true,
    });
  }, []);

  return (
    <PlatformContext.Provider value={platformData}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (context === undefined) {
    throw new Error('usePlatform must be used within a PlatformProvider');
  }
  return context;
}
