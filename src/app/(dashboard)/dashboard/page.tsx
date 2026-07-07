"use client";

import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { VisionTerminal } from '@/components/dashboard/VisionTerminal';
import { CommandPalette } from '@/components/dashboard/CommandPalette';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { SyncPanel } from '@/components/SyncPanel';
import { Activity, Bell, User, Cpu, ShieldCheck, HeartPulse, BookOpen, Users, Database } from 'lucide-react';
import { useState, useEffect } from 'react';
import { usePlatform } from '@/components/PlatformProvider';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TiltCard } from '@/components/three/TiltCard';
import { performHealthCheck } from '@/lib/platform';
import { ExternalLink, Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const [time, setTime] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [health, setHealth] = useState<{ healthy: boolean; issues: string[] } | null>(null);
  const [role, setRole] = useState<string | undefined>(undefined);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [pendingCount, setPendingCount] = useState(0);
  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const [isOpeningDesktop, setIsOpeningDesktop] = useState(false);
  const { platform, capabilities, isDesktop } = usePlatform();

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

  useEffect(() => {
    setMounted(true);
    setHealth(performHealthCheck());

    const loadSession = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        const user = data.session?.user as any;
        setRole(user?.role as string | undefined);
        setUserId(user?.id as string | undefined);

        // Pour l'admin : charger le nombre de demandes en attente + polling
        if (user?.role === 'admin') {
          const fetchPending = async () => {
            try {
              const res = await fetch('/api/auth/pending-count');
              const d = await res.json();
              setPendingCount(d.count ?? 0);
            } catch {}
          };
          await fetchPending();
          const pollInterval = setInterval(fetchPending, 30000);
          return () => clearInterval(pollInterval);
        }
      } catch {}
    };

    const loadKnowledgeCount = async () => {
      try {
        const res = await fetch('/api/knowledge?limit=1');
        const d = await res.json();
        setKnowledgeCount(d.total ?? 0);
      } catch {}
    };

    void loadSession();
    void loadKnowledgeCount();

    const updateTime = () => setTime(new Date().toLocaleTimeString());
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // ──────────────────────────────────────────────────────────────
  // Widgets conditionnels selon le rôle
  // ──────────────────────────────────────────────────────────────
  const roleWidgets = () => {
    if (role === 'admin') {
      return (
        <div className="space-y-3">
          {pendingCount > 0 ? (
            <a href="/admin">
              <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/40 rounded text-[10px] font-code text-destructive animate-pulse hover:bg-destructive/20 transition-colors cursor-pointer">
                <Bell className="w-3 h-3 shrink-0" />
                <span><strong>{pendingCount}</strong> demande{pendingCount > 1 ? 's' : ''} en attente</span>
              </div>
            </a>
          ) : (
            <div className="flex items-center gap-2 p-2 bg-secondary/10 border border-secondary/20 rounded text-[10px] font-code text-secondary">
              <Users className="w-3 h-3 shrink-0" />
              <span>Aucune demande en attente</span>
            </div>
          )}
          <div className="flex items-center justify-between text-[10px] font-code">
            <span className="text-muted-foreground flex items-center gap-1">
              <Database className="w-3 h-3" /> Base connaissances
            </span>
            <span className="text-primary font-bold">{knowledgeCount} items</span>
          </div>
          <a href="/admin" className="block w-full text-center text-[10px] font-bold uppercase tracking-widest py-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
            Console Admin →
          </a>
        </div>
      );
    }

    if (role === 'chef-de-bloc' || role === 'chef-de-quart') {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[10px] font-code">
            <span className="text-muted-foreground flex items-center gap-1">
              <BookOpen className="w-3 h-3" /> Connaissances
            </span>
            <span className="text-primary font-bold">{knowledgeCount} items</span>
          </div>
          <a href="/dataset" className="block w-full text-center text-[10px] font-bold uppercase tracking-widest py-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
            Gérer Q/R et Procédures →
          </a>
        </div>
      );
    }

    // role === 'user' (accès simplifié)
    return (
      <div className="space-y-3">
        <p className="text-[10px] text-muted-foreground font-code">Accès rapide</p>
        <a href="/dataset" className="block w-full text-center text-[10px] font-bold uppercase tracking-widest py-2 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20">
          <span className="flex items-center justify-center gap-1.5">
            <Database className="w-3.5 h-3.5" /> Questions / Réponses
          </span>
        </a>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-transparent overflow-hidden">
      <DashboardSidebar />

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto lg:overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border/70 bg-card/30 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <div className="hidden sm:flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="font-headline font-bold text-sm uppercase tracking-widest">Moniteur Système</span>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              <StatusBadge status="online" label="AWS" />
              <StatusBadge status="online" label="DB" />
              <StatusBadge status={health?.healthy ? 'online' : 'alert'} label="SANTÉ" />
              {mounted && isDesktop && <StatusBadge status="online" label="LOCAL" />}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Bell avec badge rouge si demandes en attente (admin) */}
            <a href="/admin" className="p-2 text-muted-foreground hover:text-primary transition-colors relative hidden sm:block">
              <Bell className="w-5 h-5" />
              {pendingCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full border-2 border-background animate-pulse" />
              )}
            </a>
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{role || 'utilisateur'}</p>
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
                  <span>Ouvrir Desktop</span>
                </button>
              )}
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center border border-border overflow-hidden shrink-0">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </div>
        </header>

        {/* Contenu principal */}
        <div className="flex-1 p-4 lg:p-6 overflow-y-auto lg:overflow-hidden flex flex-col gap-4 lg:gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 shrink-0">
            <div>
              <h2 className="font-headline text-xl lg:text-2xl font-bold tracking-tight mb-1 uppercase">Cockpit Visuel</h2>
              <p className="text-xs text-muted-foreground font-code">
                {mounted ? platform.toUpperCase() : 'CHARGEMENT...'} | NOMINAL | {role?.toUpperCase() ?? 'USER'}
              </p>
            </div>
            <div className="text-left sm:text-right font-code">
              <p className="text-[9px] text-muted-foreground uppercase">Horloge Système</p>
              <p className="text-sm text-primary font-bold">
                {mounted ? time || '--:--:--' : '--:--:--'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6 flex-1 min-h-0">
            <div className="lg:col-span-3 min-h-[400px] lg:min-h-0">
              <VisionTerminal />
            </div>

            <aside className="space-y-4 lg:overflow-y-auto lg:pr-2 terminal-scroll shrink-0">
              {/* Widget rôle */}
              <TiltCard className="rounded-lg">
              <Card glass className="p-4 border-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-widest font-headline">
                    {role === 'admin' ? 'Console Admin' : role === 'user' ? 'Accès Rapide' : 'Espace Technique'}
                  </h3>
                </div>
                 {mounted && roleWidgets()}
               </Card>
               </TiltCard>

               {/* Intégrité */}
              <TiltCard className="rounded-lg">
              <Card glass className="p-4 border-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <HeartPulse className={cn('w-4 h-4', health?.healthy ? 'text-secondary' : 'text-destructive')} />
                  <h3 className="text-xs font-bold uppercase tracking-widest font-headline">Intégrité Moteur</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-code">
                    <span className="text-muted-foreground">Statut</span>
                    <span className={cn('px-1.5 py-0.5 rounded-sm uppercase font-bold', health?.healthy ? 'text-secondary' : 'text-destructive')}>
                      {health?.healthy ? 'Optimal' : 'Dégradé'}
                    </span>
                  </div>
                 </div>
               </Card>
               </TiltCard>

               {/* Capacités */}
              <TiltCard className="rounded-lg">
              <Card glass className="p-4 border-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <Cpu className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-widest font-headline">Capacités</h3>
                </div>
                <div className="space-y-2">
                  {capabilities.slice(0, 4).map((cap, i) => (
                    <div key={cap.name + i} className="flex items-center justify-between text-[10px] font-code">
                      <span className="text-muted-foreground truncate mr-2">{cap.name}</span>
                      <span className={cn('px-1.5 py-0.5 rounded-sm uppercase font-bold whitespace-nowrap', cap.status === 'actif' ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary')}>
                        {cap.status}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
              </TiltCard>

              {/* SyncPanel — Desktop uniquement */}
              {mounted && isDesktop && userId && (
                <SyncPanel userId={userId} />
              )}
            </aside>
          </div>
        </div>

        <footer className="h-8 border-t border-border bg-black/40 hidden sm:flex items-center justify-between px-6 text-[9px] font-code text-muted-foreground uppercase tracking-widest shrink-0">
          <div className="flex gap-6">
            <span>Uptime : 14j 05h</span>
            <span>Mode : {mounted ? (isDesktop ? 'NATIF' : 'WEB') : '...'}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-secondary">AI PIPE : PRÊT</span>
            {mounted && isDesktop && <span className="text-primary">CHROMA : LOCAL</span>}
          </div>
        </footer>
      </main>

      <CommandPalette />
    </div>
  );
}
