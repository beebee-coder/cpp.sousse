"use client";

import { useState, useEffect } from 'react';
import { Activity, Bell, ExternalLink, Loader2, Menu, RefreshCw } from 'lucide-react';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { ProfilePhotoMenu } from '@/components/dashboard/ProfilePhotoMenu';
import { useSession } from '@/components/SessionProvider';
import { useDashboardNav } from '@/components/dashboard/AppChrome';
import { apiClient } from '@/lib/api-client';

import { useAppMode, type AppMode } from '@/hooks/use-app-mode';

interface TopNavbarProps {
  onMenuClick?: () => void;
  health?: { healthy: boolean; issues: string[] } | null;
  mounted: boolean;
  isDesktop: boolean;
  mode?: AppMode;
  role?: string;
}

export function TopNavbar({ onMenuClick, health, mounted, isDesktop, mode, role }: TopNavbarProps) {
  const session = useSession();
  const nav = useDashboardNav();
  const resolvedRole = role ?? session.role;
  const userImage = session.user?.image;
  const pendingCount = session.pendingCount;
  const [isOpeningDesktop, setIsOpeningDesktop] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSaveImage = async (image: string | null) => {
    if (image === null) return;
    try {
      const res = await apiClient.patch<any>('/api/auth/me', { image });
      if (res.success) {
        await session.refresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenDesktop = async () => {
    try {
      setIsOpeningDesktop(true);
      const res = await fetch('/api/auth/magic-link');
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        console.error('Erreur magic link:', data.error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsOpeningDesktop(false), 2000);
    }
  };

  if (mounted) {
    console.log('[TOPBAR]', { mounted, isDesktop, mode, isOpeningDesktop });
  }

  useEffect(() => {
    if (!mounted || !isDesktop || mode !== 'hybride') return;

    let cancelled = false;

    const checkForUpdates = async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();
        if (cancelled) return;
        if (update) {
          setUpdateAvailable(true);
          setUpdateVersion(update.version ?? null);
        }
      } catch (e) {
        if (!cancelled) {
          console.warn('[UPDATER] Vérification échouée:', e);
        }
      }
    };

    checkForUpdates();

    return () => {
      cancelled = true;
    };
  }, [mounted, isDesktop, mode]);

  return (
    <header className="sticky top-0 z-40 h-14 shrink-0 flex items-center gap-3 px-3 sm:px-5 border-b border-border/70 bg-card/40 backdrop-blur-md">
      <button
        onClick={() => {
          nav?.setMobileOpen(true);
          onMenuClick?.();
        }}
        className="lg:hidden p-2 -ml-1 rounded-md text-muted-foreground hover:text-primary hover:bg-muted/60 transition-colors shrink-0"
        aria-label="Ouvrir le menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-2 shrink-0">
        <Activity className="w-4 h-4 text-primary" />
        <span className="font-headline font-bold text-sm uppercase tracking-widest hidden sm:inline">Moniteur Système</span>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 shrink-0">
        <StatusBadge status="online" label="AWS" />
        <StatusBadge status="online" label="DB" />
        <StatusBadge status={health?.healthy ? 'online' : 'alert'} label="SANTÉ" />
        {mounted && isDesktop && mode !== 'hybride' && <StatusBadge status="online" label="OFFLINE" />}
        {mounted && isDesktop && mode === 'hybride' && <StatusBadge status="online" label="HYBRIDE" />}
        {session.degraded && (
          <span
            title="La base locale SQLite est indisponible (corrompue ou verrouillée). Vous avez été déconnecté par sécurité."
            className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-amber-500/50 bg-amber-500/10 text-amber-500 whitespace-nowrap"
          >
            ⚠ Mode dégradé — base locale indisponible
          </span>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {resolvedRole === 'admin' && (
          <a href="/admin" className="p-2 text-muted-foreground hover:text-primary transition-colors relative hidden sm:block">
            <Bell className="w-5 h-5" />
            {pendingCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full border-2 border-background animate-pulse" />
            )}
          </a>
        )}

        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{resolvedRole || 'utilisateur'}</p>
            <p className="text-xs font-medium">Session active</p>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/auth/signout', { method: 'POST' });
              window.location.href = '/auth/signin';
            }}
            className="rounded-md border border-border px-2 py-1 text-xs"
          >
            Déconnexion
          </button>
          {mounted && !isDesktop && (
            <button
              onClick={handleOpenDesktop}
              disabled={isOpeningDesktop}
              className="rounded-md bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20 transition-colors px-2 py-1 text-xs flex items-center gap-1 font-bold"
              title="Lancer l'application locale (Desktop) en conservant votre session"
            >
              {isOpeningDesktop ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
              <span className="hidden sm:inline">Ouvrir Desktop</span>
            </button>
          )}
          {mounted && isDesktop && mode === 'hybride' && (
            <button
              onClick={async () => {
                if (isUpdating) return;
                setIsUpdating(true);
                try {
                  const [{ check }, { message }, { relaunch }] = await Promise.all([
                    import('@tauri-apps/plugin-updater'),
                    import('@tauri-apps/plugin-dialog'),
                    import('@tauri-apps/plugin-process'),
                  ]);

                  const update = await check();
                  if (!update) {
                    await message('Aucune mise à jour disponible.', { title: 'VisioNode', kind: 'info' });
                    return;
                  }

                  const confirm = await message(
                    `Mise à jour ${update.version} disponible. Télécharger et installer ?`,
                    { title: 'Mise à jour disponible', kind: 'info' }
                  );

                  if (confirm) {
                    await update.downloadAndInstall();
                    await relaunch();
                  }
                } catch (e) {
                  console.error('[UPDATER] Échec:', e);
                  await import('@tauri-apps/plugin-dialog').then(m => m.message('Échec de la mise à jour. Veuillez réessayer.', { title: 'Erreur', kind: 'error' }));
                } finally {
                  setIsUpdating(false);
                }
              }}
              className="rounded-md bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors px-2 py-1 text-xs flex items-center gap-1 font-bold"
              title="Vérifier et installer les mises à jour"
            >
              {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              <span className="hidden sm:inline">
                {updateAvailable ? `Mettre à jour (v${updateVersion})` : 'Mettre à jour'}
              </span>
            </button>
          )}
          <ProfilePhotoMenu currentImage={userImage} onSave={handleSaveImage} size={32} />
        </div>
      </div>
    </header>
  );
}
