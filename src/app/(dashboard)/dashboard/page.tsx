"use client";

import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { VisionTerminal } from '@/components/dashboard/VisionTerminal';
import { CommandPalette } from '@/components/dashboard/CommandPalette';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Activity, Bell, User, Cpu, ShieldCheck, HeartPulse, Menu } from 'lucide-react';
import { useState, useEffect } from 'react';
import { usePlatform } from '@/components/PlatformProvider';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { performHealthCheck } from '@/lib/platform';

export default function DashboardPage() {
  const [time, setTime] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [health, setHealth] = useState<{ healthy: boolean, issues: string[] } | null>(null);
  const { platform, capabilities, isDesktop } = usePlatform();

  useEffect(() => {
    setMounted(true);
    setHealth(performHealthCheck());
    
    const updateTime = () => setTime(new Date().toLocaleTimeString());
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto lg:overflow-hidden">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="font-headline font-bold text-sm uppercase tracking-widest">Moniteur Système</span>
            </div>
            {/* Mobile Title Spacer */}
            <div className="lg:hidden w-10" /> 
            
            <div className="hidden sm:flex gap-2 lg:gap-4 overflow-x-auto no-scrollbar">
              <StatusBadge status="online" label="AWS" />
              <StatusBadge status="online" label="DB" />
              <StatusBadge status={health?.healthy ? "online" : "alert"} label="SANTÉ" />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="p-2 text-muted-foreground hover:text-primary transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full border-2 border-background" />
            </button>
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center border border-border overflow-hidden">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-6 overflow-y-auto lg:overflow-hidden flex flex-col gap-4 lg:gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 shrink-0">
            <div>
              <h2 className="font-headline text-xl lg:text-2xl font-bold tracking-tight mb-1 uppercase">Cockpit Visuel</h2>
              <p className="text-xs text-muted-foreground font-code">
                {platform.toUpperCase()} | NOMINAL
              </p>
            </div>
            <div className="text-left sm:text-right font-code">
              <p className="text-[9px] text-muted-foreground uppercase">Horloge Système</p>
              <p className="text-sm text-primary font-bold">
                {mounted ? (time || '--:--:--') : '--:--:--'}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6 flex-1 min-h-0">
            <div className="lg:col-span-3 min-h-[400px] lg:min-h-0">
              <VisionTerminal />
            </div>
            
            <aside className="space-y-4 lg:overflow-y-auto lg:pr-2 terminal-scroll shrink-0">
              <Card className="p-4 border-primary/20 bg-black/20">
                <div className="flex items-center gap-2 mb-3">
                  <HeartPulse className={cn("w-4 h-4", health?.healthy ? "text-secondary" : "text-destructive")} />
                  <h3 className="text-xs font-bold uppercase tracking-widest font-headline">Intégrité Moteur</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-code">
                    <span className="text-muted-foreground">Statut</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-sm uppercase font-bold",
                      health?.healthy ? "text-secondary" : "text-destructive"
                    )}>
                      {health?.healthy ? "Optimal" : "Dégradé"}
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="p-4 border-primary/20 bg-black/20">
                <div className="flex items-center gap-2 mb-3">
                  <Cpu className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-widest font-headline">Capacités</h3>
                </div>
                <div className="space-y-2">
                  {capabilities.slice(0, 4).map((cap, i) => (
                    <div key={cap.name + i} className="flex items-center justify-between text-[10px] font-code">
                      <span className="text-muted-foreground truncate mr-2">{cap.name}</span>
                      <span className={cn(
                        "px-1.5 py-0.5 rounded-sm uppercase font-bold whitespace-nowrap",
                        cap.status === 'actif' ? "bg-secondary/20 text-secondary" : "bg-primary/20 text-primary"
                      )}>
                        {cap.status}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4 border-secondary/20 bg-black/20 hidden sm:block">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-secondary" />
                  <h3 className="text-xs font-bold uppercase tracking-widest font-headline">Sécurité</h3>
                </div>
                <div className="space-y-2 font-code text-[9px]">
                  <p className="text-secondary">AES-256-GCM ACTIF</p>
                  <p className="text-primary">FLUX VERS NEON</p>
                </div>
              </Card>
            </aside>
          </div>
        </div>
        
        <footer className="h-8 border-t border-border bg-black/40 hidden sm:flex items-center justify-between px-6 text-[9px] font-code text-muted-foreground uppercase tracking-widest shrink-0">
          <div className="flex gap-6">
            <span>Uptime : 14j 05h</span>
            <span>Mode : {isDesktop ? "NATIF" : "WEB"}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-secondary">AI PIPE : PRÊT</span>
          </div>
        </footer>
      </main>

      <CommandPalette />
    </div>
  );
}
