"use client";

import { allNavItems } from '@/components/dashboard/Sidebar';
import { TopNavbar } from '@/components/dashboard/TopNavbar';
import { CommandPalette } from '@/components/dashboard/CommandPalette';
import { useState, useEffect } from 'react';
import { usePlatform } from '@/components/PlatformProvider';
import { useSession } from '@/components/SessionProvider';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TiltCard } from '@/components/three/TiltCard';
import { performHealthCheck } from '@/lib/platform';
import Link from 'next/link';
import { User } from 'lucide-react';

const navDescriptions: Record<string, string> = {
  '/dashboard': 'Vue d’ensemble et centre de commandement',
  '/chat': 'Assistant conversationnel neural',
  '/admin': 'Gestion des utilisateurs et des accès',
  '/dataset': 'Base d’entraînement IA et procédures',
  '/bdd': 'Exploration des bases de données',
  '/bank': 'Bibliothèque d’images médicales',
  '/conference': 'Flux vidéo et téléconférence',
  '/download': 'Installation de l’application desktop',
};

export default function DashboardPage() {
  const [time, setTime] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [health, setHealth] = useState<{ healthy: boolean; issues: string[] } | null>(null);
  const { isDesktop } = usePlatform();
  const { role, user } = useSession();

  useEffect(() => {
    setMounted(true);
    setHealth(performHealthCheck());

    const updateTime = () => setTime(new Date().toLocaleTimeString());
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Même logique de filtrage que la barre latérale, hors Tableau de Bord (page courante)
  const navItems = allNavItems.filter((item) => {
    if (item.href === '/dashboard') return false;

    if (role === 'admin') return true;

    if (role === 'chef-de-bloc' || role === 'chef-de-quart') {
      return !['/bdd', '/pipeline', '/admin'].includes(item.href);
    }

    return ['/chat', '/dataset'].includes(item.href);
  });

  return (
    <div className="flex flex-col h-screen bg-transparent overflow-hidden">
      <TopNavbar
        health={health}
        mounted={mounted}
        isDesktop={isDesktop}
        role={role}
      />

      <div className="flex flex-1 min-h-0">
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto lg:overflow-hidden">
          {/* Contenu principal — cartes de navigation */}
          <div className="flex-1 p-4 lg:p-6 overflow-y-auto flex flex-col gap-4 lg:gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 shrink-0">
            <div>
              <h2 className="font-headline text-xl lg:text-2xl font-bold tracking-tight mb-1 uppercase">Centre de Commandement</h2>
              <p className="text-xs text-muted-foreground font-code">
                {mounted ? (isDesktop ? 'NATIF' : 'CLOUD').toUpperCase() : 'CHARGEMENT...'} | NOMINAL | {role?.toUpperCase() ?? 'USER'}
              </p>
            </div>
            <div className="text-left sm:text-right font-code">
              <p className="text-[9px] text-muted-foreground uppercase">Horloge Système</p>
              <p className="text-sm text-primary font-bold">
                {mounted ? time || '--:--:--' : '--:--:--'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
            {/* Carte Profil Utilisateur — même style et dimension que les cartes de navigation */}
            <Link href="/profile" className="group block h-full">
              <TiltCard className="rounded-lg h-full">
                <Card glass className="p-5 border-primary/20 hover:border-primary/50 hover:shadow-glow transition-all duration-300 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="glow-ring rounded-md p-2 bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-[9px] font-code uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                      /profile
                    </span>
                  </div>
                  <h3 className="font-headline font-bold text-sm uppercase tracking-wide mb-1.5 group-hover:text-primary transition-colors flex items-center gap-2">
                    <span className="glow-ring rounded-full p-0.5 shrink-0">
                      <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center border border-primary/30 overflow-hidden block">
                        {mounted && user?.image ? (
                          <img src={user.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-primary" />
                        )}
                      </span>
                    </span>
                    Profil Utilisateur
                  </h3>
                  <p className="text-xs text-muted-foreground font-code leading-relaxed">
                    {mounted && user?.email ? user.email : 'Gérer votre compte et vos accès'}
                  </p>
                </Card>
              </TiltCard>
            </Link>

            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="group block h-full">
                <TiltCard className="rounded-lg h-full">
                  <Card glass className="p-5 border-primary/20 hover:border-primary/50 hover:shadow-glow transition-all duration-300 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <div className="glow-ring rounded-md p-2 bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <item.icon className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-[9px] font-code uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                        {item.href}
                      </span>
                    </div>
                    <h3 className="font-headline font-bold text-sm uppercase tracking-wide mb-1.5 group-hover:text-primary transition-colors">
                      {item.label}
                    </h3>
                    <p className="text-xs text-muted-foreground font-code leading-relaxed">
                      {navDescriptions[item.href] ?? ''}
                    </p>
                  </Card>
                </TiltCard>
              </Link>
            ))}
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
      </div>

      <CommandPalette />
    </div>
  );
}
