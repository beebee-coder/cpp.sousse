'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';

interface DashboardNavValue {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const DashboardNavContext = createContext<DashboardNavValue | null>(null);

/**
 * État d'ouverture du tiroir mobile partagé entre la Sidebar et la TopNavbar,
 * afin que le bouton "menu" de la barre supérieure puisse contrôler le tiroir
 * même quand la Sidebar est rendue une seule fois au niveau racine.
 */
export function useDashboardNav(): DashboardNavValue | null {
  return useContext(DashboardNavContext);
}

/**
 * Coque de navigation persistante.
 *
 * La Sidebar y est montée UNE SEULE FOIS (dans le layout racine) et SURVIT
 * à toutes les navigations clientes : elle n'est donc plus re-montée ni
 * re-validée à chaque changement de route, ce qui supprime le flash et les
 * requêtes réseau redondantes constatés auparavant.
 */
export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Pas de chrome latéral sur les écrans d'authentification.
  if (pathname.startsWith('/auth')) {
    return <>{children}</>;
  }

  // Le bouton "menu" dédié de la TopNavbar gère déjà le tiroir sur ces pages.
  const hideMobileTrigger = pathname === '/dashboard' || pathname === '/profile';

  return (
    <DashboardNavContext.Provider value={{ mobileOpen, setMobileOpen }}>
      <div className="flex h-screen overflow-hidden bg-transparent">
        <DashboardSidebar
          hideMobileTrigger={hideMobileTrigger}
          mobileOpen={mobileOpen}
          onMobileOpenChange={setMobileOpen}
        />
        <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
          {children}
        </div>
      </div>
    </DashboardNavContext.Provider>
  );
}
