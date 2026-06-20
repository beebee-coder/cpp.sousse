
"use client";

import { 
  LayoutDashboard, 
  Terminal, 
  Database, 
  Cloud, 
  Monitor,
  Camera,
  Activity,
  MessageSquare,
  Cpu,
  RefreshCw,
  Hammer,
  Clock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlatform } from '@/components/PlatformProvider';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';

const navItems = [
  { icon: LayoutDashboard, label: 'Tableau de Bord', href: '/dashboard' },
  { icon: MessageSquare, label: 'Chat Neural', href: '/chat' },
  { icon: Camera, label: 'Flux Vidéo', href: '#' },
  { icon: Database, label: 'Assets & Datas', href: '#' },
  { icon: Terminal, label: 'Console Audit', href: '#' },
  { icon: Activity, label: 'Télémétrie LPU', href: '#' },
];

export function DashboardSidebar() {
  const { platform, isDesktop } = usePlatform();
  const pathname = usePathname();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isForging, setIsForging] = useState(false);
  const [lastUplink, setLastUplink] = useState<string | null>(null);
  
  const [report, setReport] = useState<{
    open: boolean;
    title: string;
    success: boolean;
    message: string;
    logs: string;
    errors: string;
  }>({
    open: false,
    title: '',
    success: false,
    message: '',
    logs: '',
    errors: ''
  });

  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    const saved = localStorage.getItem('visionode_last_uplink');
    if (saved) setLastUplink(saved);
  }, []);

  const triggerSync = async (mode: 'web' | 'desktop') => {
    mode === 'web' ? setIsSyncing(true) : setIsForging(true);
    
    try {
      const res = await fetch('/api/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      const result = await res.json();
      
      if (result.success) {
        const now = new Date().toLocaleTimeString();
        setLastUplink(now);
        localStorage.setItem('visionode_last_uplink', now);
      }
      
      setReport({
        open: true,
        title: mode === 'web' ? 'Rapport Uplink Web (Vercel)' : 'Rapport Forge Desktop (Natif)',
        ...result
      });
    } catch (err: any) {
      setReport({
        open: true,
        title: 'Erreur Critique Pipeline',
        success: false,
        message: 'Impossible de contacter le service de synchronisation.',
        logs: '',
        errors: err.message
      });
    } finally {
      mode === 'web' ? setIsSyncing(false) : setIsForging(false);
    }
  };

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
            <Monitor className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="font-headline font-bold text-lg tracking-tighter uppercase">VISIONODE</h1>
        </Link>
        <p className="text-[10px] text-muted-foreground font-code uppercase tracking-[0.2em]">PRECISION_ENGINE v1.0</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto terminal-scroll">
        <div className="mb-4">
          <p className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Navigation</p>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-sm transition-all group",
                  isActive 
                    ? "bg-primary/10 text-primary border-r-2 border-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
                <span className="font-headline tracking-wide uppercase text-xs">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {isDev && (
          <div className="pt-4 border-t border-border mt-4">
            <div className="px-3 mb-2 flex flex-col gap-1">
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="w-3 h-3" />
                Pipeline Industriel
              </p>
              {lastUplink && (
                <p className="text-[9px] font-code text-muted-foreground flex items-center gap-1 uppercase">
                  <Clock className="w-2.5 h-2.5" />
                  Sync : {lastUplink}
                </p>
              )}
            </div>
            <div className="space-y-2 px-2">
              <Button 
                variant="ghost" 
                size="sm" 
                disabled={isSyncing}
                onClick={() => triggerSync('web')}
                className="w-full justify-start text-[10px] h-8 font-code uppercase hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/30"
              >
                {isSyncing ? <RefreshCw className="w-3 h-3 mr-2 animate-spin" /> : <Cloud className="w-3 h-3 mr-2" />}
                Mettre à jour Web
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                disabled={isForging}
                onClick={() => triggerSync('desktop')}
                className="w-full justify-start text-[10px] h-8 font-code uppercase hover:bg-secondary/10 hover:text-secondary border border-transparent hover:border-secondary/30"
              >
                {isForging ? <RefreshCw className="w-3 h-3 mr-2 animate-spin" /> : <Hammer className="w-3 h-3 mr-2" />}
                Forger Desktop
              </Button>
            </div>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-border bg-black/20">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">État Système</span>
          <div className="flex items-center gap-1">
            <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isDesktop ? "bg-secondary" : "bg-primary")} />
            <span className={cn("text-[10px] font-code uppercase", isDesktop ? "text-secondary" : "text-primary")}>
              {isDesktop ? "NATIF" : "CLOUD"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-background/50 border border-border rounded-sm">
          {isDesktop ? <Cpu className="w-3 h-3 text-secondary" /> : <Cloud className="w-3 h-3 text-primary" />}
          <span className="text-[10px] font-code text-muted-foreground truncate">{platform}</span>
        </div>
      </div>

      <Dialog open={report.open} onOpenChange={(o) => setReport(prev => ({ ...prev, open: o }))}>
        <DialogContent className="max-w-2xl bg-card border-primary/20 font-code">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              {report.success ? <CheckCircle2 className="w-5 h-5 text-secondary" /> : <AlertCircle className="w-5 h-5 text-destructive" />}
              <DialogTitle className="uppercase tracking-tighter text-sm">{report.title}</DialogTitle>
            </div>
            <DialogDescription className="text-xs uppercase text-muted-foreground">
              {report.message}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            {report.errors && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-sm">
                <p className="text-[10px] font-bold text-destructive uppercase mb-2">&gt; ERREUR_CRITIQUE_PIPE</p>
                <ScrollArea className="h-24 text-[10px] text-destructive/80">
                  <pre className="whitespace-pre-wrap">{report.errors}</pre>
                </ScrollArea>
              </div>
            )}
            
            <div className="p-3 bg-black/40 border border-border rounded-sm">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">&gt; JOURNAUX_AUDIT_FLUX</p>
              <ScrollArea className="h-64 text-[10px] text-foreground/70">
                <pre className="whitespace-pre-wrap">{report.logs || 'Aucun log enregistré.'}</pre>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button 
              size="sm" 
              onClick={() => setReport(prev => ({ ...prev, open: false }))}
              className="font-code text-[10px] uppercase"
            >
              Fermer la console
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
