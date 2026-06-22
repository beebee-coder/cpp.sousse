
"use client";

import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Rocket, 
  Github, 
  Monitor, 
  CheckCircle2, 
  RefreshCw, 
  ShieldCheck, 
  AlertCircle,
  Terminal,
  Zap,
  Hammer,
  ChevronLeft,
  LucideIcon
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type PipelineStep = 'idle' | 'uplink' | 'downlink' | 'forge' | 'success' | 'error';

export default function PipelinePage() {
  const router = useRouter();
  const [status, setStepStatus] = useState<PipelineStep>('idle');
  const [logs, setLogs] = useState<string>('');
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    setIsDev(process.env.NODE_ENV === 'development');
  }, []);

  const runCommand = async (mode: 'web' | 'desktop' | 'pull') => {
    const stepMap: Record<string, PipelineStep> = {
      'web': 'uplink',
      'desktop': 'forge',
      'pull': 'downlink'
    };
    
    setStepStatus(stepMap[mode]);
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => `${prev}\n🚀 [${timestamp}] INITIATION_${mode.toUpperCase()}...`);

    try {
      const res = await fetch('/api/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      const result = await res.json();
      
      setLogs(prev => `${prev}\n${result.logs || ''}\n${result.errors || ''}`);
      
      if (result.success) {
        setLogs(prev => `${prev}\n✅ [${new Date().toLocaleTimeString()}] OPÉRATION_TERMINÉE`);
        setStepStatus('success');
      } else {
        setLogs(prev => `${prev}\n❌ [${new Date().toLocaleTimeString()}] ÉCHEC : ${result.message || 'Inconnu'}`);
        setStepStatus('error');
      }
    } catch (err: any) {
      setLogs(prev => `${prev}\n❌ [${new Date().toLocaleTimeString()}] ERREUR_CRITIQUE : ${err.message}`);
      setStepStatus('error');
    }
  };

  if (!isDev) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full p-8 border-destructive/30 bg-destructive/5 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-headline font-bold text-destructive uppercase tracking-widest">Zone Restreinte</h2>
          <p className="text-xs text-muted-foreground font-code mt-4 leading-relaxed">
            Le pilotage du pipeline industriel est une fonctionnalité exclusive à l'environnement de développement local (Forge).
          </p>
          <Button variant="outline" className="mt-6 h-8 text-[10px] uppercase font-code" onClick={() => router.push('/dashboard')}>
            Retour au Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-primary animate-pulse" />
              <span className="font-headline font-bold text-xs lg:text-sm uppercase tracking-widest text-primary">Pilotage Industriel</span>
            </div>
            <div className="hidden sm:block h-4 w-px bg-border mx-2" />
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-sm">
              <ShieldCheck className="w-3 h-3 text-secondary" />
              <span className="text-[9px] font-code text-secondary uppercase font-bold tracking-tighter">Forge Active</span>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/dashboard')}
            className="text-[9px] font-code uppercase text-muted-foreground hidden sm:flex"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />
            Dashboard
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-8 flex flex-col gap-6 lg:gap-8 max-w-[1400px] mx-auto w-full">
            
            {/* Visual Pipeline Flow */}
            <div className="relative py-8 lg:py-12 px-4">
              {/* Line - Centered on the icon size (w-10/12) */}
              <div className="absolute top-[52px] lg:top-[60px] left-8 right-8 h-0.5 bg-border z-0" />
              
              <div className="relative z-10 flex justify-between items-start gap-4">
                <PipelineNode 
                  icon={Monitor} 
                  label="Source" 
                  active={status === 'uplink'} 
                  completed={['downlink', 'forge', 'success'].includes(status)} 
                />
                
                <div className="flex flex-col items-center gap-2 pt-2">
                  <Github className={cn("w-5 h-5 lg:w-6 lg:h-6 text-muted-foreground transition-all", (status === 'uplink' || status === 'downlink') && "animate-bounce text-primary")} />
                  <span className="text-[7px] lg:text-[8px] font-code uppercase text-muted-foreground hidden sm:block">Registre</span>
                </div>

                <PipelineNode 
                  icon={Hammer} 
                  label="Station Build" 
                  active={status === 'forge'} 
                  completed={status === 'success'} 
                />

                <div className="flex flex-col items-center gap-2 pt-2">
                  <CheckCircle2 className={cn("w-5 h-5 lg:w-6 lg:h-6 text-muted-foreground transition-all", status === 'success' && "text-secondary")} />
                  <span className="text-[7px] lg:text-[8px] font-code uppercase text-muted-foreground hidden sm:block">Release</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Actions Panel */}
              <div className="space-y-4">
                <h3 className="text-[10px] lg:text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground px-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Actions de Flux
                </h3>
                
                <div className="grid grid-cols-1 gap-4">
                  <ActionCard 
                    title="Phase Aval (Pull)" 
                    description="Sync Locale" 
                    icon={RefreshCw} 
                    onClick={() => runCommand('pull')}
                    loading={status === 'downlink'}
                    disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
                    variant="secondary"
                  />
                  
                  <ActionCard 
                    title="Phase Amont (Push)" 
                    description="Uplink Source" 
                    icon={Rocket} 
                    onClick={() => runCommand('web')}
                    loading={status === 'uplink'}
                    disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
                    variant="outline"
                  />

                  <ActionCard 
                    title="Phase Finale (Build)" 
                    description="Forger Desktop" 
                    icon={Hammer} 
                    onClick={() => runCommand('desktop')}
                    loading={status === 'forge'}
                    disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
                    variant="primary"
                  />
                </div>

                <Card className="p-4 border-border bg-black/40">
                  <p className="text-[8px] lg:text-[9px] font-code text-muted-foreground leading-tight uppercase italic">
                    * GITHUB_TOKEN requis en local pour piloter le registre distant.
                  </p>
                </Card>
              </div>

              {/* Console Log Panel */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-[10px] lg:text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground px-2">
                  <Terminal className="w-4 h-4 text-muted-foreground" />
                  Journaux d'Audit Pipeline
                </h3>
                <Card className="border-border bg-black p-4 flex flex-col h-[400px] lg:h-[500px] shadow-inner shadow-primary/5 overflow-hidden">
                  <ScrollArea className="flex-1 font-code text-[10px] lg:text-[11px] text-foreground/80 terminal-scroll">
                    <pre className="whitespace-pre-wrap py-2">
                      {logs || '> Système en veille. Prêt pour pilotage.'}
                      {status === 'uplink' && '\n📡 TRANSMISSION_SOURCE_EN_COURS...'}
                      {status === 'downlink' && '\n📡 RÉCUPÉRATION_MODIFICATIONS_EN_COURS...'}
                      {status === 'forge' && '\n🏗️ COMPILATION_NATIVE_EN_COURS...'}
                    </pre>
                  </ScrollArea>
                  <div className="flex gap-2 pt-4 border-t border-border/30 shrink-0">
                    <div className="w-2 h-2 rounded-full bg-red-500/20" />
                    <div className="w-2 h-2 rounded-full bg-yellow-500/20" />
                    <div className="w-2 h-2 rounded-full bg-green-500/20" />
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function PipelineNode({ icon: Icon, label, active, completed }: { icon: LucideIcon, label: string, active: boolean, completed: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 z-10 w-24 sm:w-32">
      <div className={cn(
        "w-10 h-10 lg:w-12 lg:h-12 rounded-full border-2 flex items-center justify-center transition-all duration-500 bg-background",
        completed ? "border-secondary text-secondary shadow-[0_0_15px_rgba(46,184,146,0.3)] bg-secondary/10" :
        active ? "border-primary text-primary animate-pulse shadow-[0_0_20px_rgba(50,181,212,0.4)] scale-110 bg-primary/20" :
        "border-border text-muted-foreground bg-card"
      )}>
        <Icon className="w-5 h-5 lg:w-6 lg:h-6" />
      </div>
      <span className={cn(
        "text-[8px] lg:text-[10px] font-headline font-bold uppercase tracking-widest text-center leading-tight",
        active ? "text-primary" : completed ? "text-secondary" : "text-muted-foreground"
      )}>
        {label}
      </span>
    </div>
  );
}

function ActionCard({ title, description, icon: Icon, onClick, loading, disabled, variant }: any) {
  const variantClasses = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "border-primary/50 text-primary hover:bg-primary/5 border"
  };

  return (
    <Card className="p-3 border-border bg-black/20 group hover:border-primary/30 transition-colors">
      <p className="text-[8px] lg:text-[9px] text-muted-foreground font-code uppercase mb-2">&gt; {title}</p>
      <Button 
        variant={variant === 'outline' ? 'outline' : 'default'}
        className={cn(
          "w-full justify-start font-headline text-[9px] lg:text-[10px] h-9 lg:h-10 uppercase shadow-lg transition-transform active:scale-95",
          variantClasses[variant as keyof typeof variantClasses]
        )} 
        onClick={onClick}
        disabled={disabled || loading}
      >
        <Icon className={cn("w-3.5 h-3.5 mr-2", loading && "animate-spin")} />
        {loading ? "TRAVAIL..." : description}
      </Button>
    </Card>
  );
}
