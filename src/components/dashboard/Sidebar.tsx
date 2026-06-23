"use client";

import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Terminal, 
  Database, 
  Monitor,
  Camera,
  MessageSquare,
  Cpu,
  ShieldCheck,
  Rocket,
  ChevronRight,
  HardDrive,
  Download,
  Menu,
  Cloud,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlatform } from '@/components/PlatformProvider';
import { SyncPanel } from '@/components/dashboard/SyncPanel';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const navItems = [
  { icon: LayoutDashboard, label: 'Tableau de Bord', href: '/dashboard' },
  { icon: MessageSquare, label: 'Chat Neural', href: '/chat' },
  { icon: Database, label: 'Base RAG', href: '/dataset' },
  { icon: HardDrive, label: 'Explorateur BDD', href: '/bdd' },
  { icon: Download, label: 'Installateur Desktop', href: '/download' },
  { icon: Camera, label: 'Flux Vidéo', href: '#' },
  { icon: Terminal, label: 'Console Audit', href: '#' },
];

interface SidebarContentProps {
  pathname: string;
  isDesktop: boolean;
  isReady: boolean;
  onNavigate?: () => void;
}

function SidebarContent({ pathname, isDesktop, isReady, onNavigate }: SidebarContentProps) {
  const [mounted, setMounted] = useState(false);
  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex flex-col h-full bg-card overflow-hidden">
      <div className="p-6 border-b border-border shrink-0">
        <Link href="/dashboard" className="flex items-center gap-3 mb-1" onClick={onNavigate}>
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center shadow-[0_0_15px_rgba(50,181,212,0.3)] shrink-0">
            <Monitor className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="font-headline font-bold text-lg tracking-tighter uppercase truncate">VISIONODE</h1>
        </Link>
        <p className="text-[10px] text-muted-foreground font-code uppercase tracking-[0.2em] truncate">PRECISION_ENGINE v1.0</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto terminal-scroll min-h-0">
        <div className="mb-4">
          <p className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Navigation</p>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-sm transition-all group",
                  isActive 
                    ? "bg-primary/10 text-primary border-r-2 border-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
                <span className="font-headline tracking-wide uppercase text-[11px] truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {isDev && (
          <div className="pt-4 border-t border-border mt-4">
            <p className="px-3 text-[10px] font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-2">
              <ShieldCheck className="w-3 h-3" />
              Zone Forge (DEV)
            </p>
            <Link
              href="/pipeline"
              onClick={onNavigate}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-sm transition-all group border border-dashed border-primary/20",
                pathname === '/pipeline' 
                  ? "bg-primary/20 text-primary border-primary/50" 
                  : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Rocket className="w-4 h-4 animate-pulse shrink-0" />
                <span className="font-headline tracking-wide uppercase text-[11px] truncate">Pilotage Pipeline</span>
              </div>
              <ChevronRight className="w-3 h-3 opacity-50 shrink-0" />
            </Link>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-border bg-black/20 space-y-3 shrink-0">
        <div className="flex items-center justify-between h-8">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Mode</span>
          {!mounted || !isReady ? (
            <div className="flex items-center gap-2 px-2 py-1 bg-muted/20 rounded-sm min-w-[90px] justify-center h-7">
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-[90px] justify-end">
              <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse shrink-0", isDesktop ? "bg-secondary" : "bg-primary")} />
              <div className={cn(
                "flex items-center gap-1.5 p-1 px-2 border rounded-sm transition-all min-w-[75px] justify-center h-7",
                isDesktop ? "bg-secondary/5 border-secondary/20" : "bg-primary/5 border-primary/20"
              )}>
                {isDesktop ? (
                  <Cpu className="w-3 h-3 text-secondary" />
                ) : (
                  <Cloud className="w-3 h-3 text-primary" />
                )}
                <span className={cn(
                  "text-[9px] font-code uppercase font-bold", 
                  isDesktop ? "text-secondary" : "text-primary"
                )}>
                  {isDesktop ? "NATIF" : "CLOUD"}
                </span>
              </div>
            </div>
          )}
        </div>
        {mounted && <SyncPanel />}
      </div>
    </div>
  );
}

export function DashboardSidebar() {
  const { isDesktop, isReady } = usePlatform();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const handleClose = () => setOpen(false);

  return (
    <>
      {/* Mobile Trigger */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="bg-card/80 backdrop-blur-sm border-primary/30 text-primary hover:bg-card">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 border-r border-border h-full">
            <SidebarContent 
              pathname={pathname} 
              isDesktop={isDesktop} 
              isReady={isReady} 
              onNavigate={handleClose} 
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Permanent Sidebar */}
      <div className="hidden lg:flex w-64 border-r border-border bg-card flex-col h-full shrink-0 overflow-hidden">
        <SidebarContent 
          pathname={pathname} 
          isDesktop={isDesktop} 
          isReady={isReady} 
        />
      </div>
    </>
  );
}
