'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getPlatformInfo, type PlatformCapabilities, type PlatformType } from '@/lib/platform';

interface PlatformContextType {
  isDesktop: boolean;
  platform: PlatformType;
  capabilities: PlatformCapabilities[];
  isReady: boolean;
}

const PlatformContext = createContext<PlatformContextType | undefined>(undefined);

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [platformData, setPlatformData] = useState<PlatformContextType>({
    isDesktop: false,
    platform: 'Vercel Web',
    capabilities: [],
    isReady: false,
  });

  useEffect(() => {
    // Only run on client
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
