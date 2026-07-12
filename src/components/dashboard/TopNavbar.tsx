"use client";

import { useState, useEffect } from 'react';
import { Activity, Bell, ExternalLink, Loader2, Menu } from 'lucide-react';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { ProfilePhotoMenu } from '@/components/dashboard/ProfilePhotoMenu';
import { useSession } from '@/components/SessionProvider';
import { useDashboardNav } from '@/components/dashboard/AppChrome';

interface TopNavbarProps {
  onMenuClick?: () => void;
  health?: { healthy: boolean; issues: string[] } | null;
  mounted: boolean;
  isDesktop: boolean;
  role?: string;
}

export function TopNavbar({ onMenuClick, health, mounted, isDesktop, role }: TopNavbarProps) {
  const session = useSession();
  const nav = useDashboardNav();
  const resolvedRole = role ?? session.role;
  const userImage = session.user?.image;
  const pendingCount = session.pendingCount;
  const [isOpeningDesktop, setIsOpeningDesktop] = useState(false);

  const handleSaveImage = async (image: string | null) => {
    if (image === null) return;
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      });
      const data = await res.json();
      if (data.success) {
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
        {mounted && isDesktop && <StatusBadge status="online" label="LOCAL" />}
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
          <ProfilePhotoMenu currentImage={userImage} onSave={handleSaveImage} size={32} />
        </div>
      </div>
    </header>
  );
}
