'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getPlatformInfo, waitForDesktopDetection, type PlatformCapabilities, type PlatformType } from '@/lib/platform';
import { useToast } from '@/hooks/use-toast';

interface PlatformContextType {
  isDesktop: boolean;
  platform: PlatformType;
  capabilities: PlatformCapabilities[];
  isReady: boolean;
}

interface PlatformProviderProps {
  children: React.ReactNode;
  initialIsDesktop?: boolean;
  initialLocalDBReadOnly?: boolean;
}

const PlatformContext = createContext<PlatformContextType | undefined>(undefined);

export function PlatformProvider({ children, initialIsDesktop = false, initialLocalDBReadOnly = false }: PlatformProviderProps) {
  const [platformData, setPlatformData] = useState<PlatformContextType>({
    isDesktop: initialIsDesktop,
    platform: initialIsDesktop ? 'Tauri Natif' : 'Vercel Web',
    capabilities: [],
    isReady: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    const info = getPlatformInfo();
    setPlatformData({
      ...info,
      isReady: true,
    });

    waitForDesktopDetection(5000).then((detected) => {
      if (detected) {
        const delayed = getPlatformInfo();
        setPlatformData({
          ...delayed,
          isReady: true,
        });
      }
    });

    if (initialLocalDBReadOnly) {
      toast({
        title: "BDD locale indisponible",
        description: "Le système de fichiers du serveur est en lecture seule. Les fonctionnalités locales sont désactivées.",
        variant: "destructive",
      });
    }
  }, [initialLocalDBReadOnly, toast]);

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
