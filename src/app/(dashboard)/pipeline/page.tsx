
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
  ArrowLeft, 
  ShieldCheck, 
  AlertCircle,
  Terminal,
  Zap,
  Hammer,
  ChevronLeft
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
    // Vérification stricte de l'environnement de développement
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
    <div className="flex h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-primary animate-pulse" />
              <span className="font-headline font-bold text-sm uppercase tracking-widest text-primary">Centre de Pilotage Industriel</span>
            </div>
            <div className="h-4 w-px bg-border mx-2" />
            <div className="flex items-center gap-2 px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-sm">
              <ShieldCheck className="w-3 h-3 text-secondary" />
              <span className="text-[9px] font-code text-secondary uppercase font-bold tracking-tighter">Contrôle de Forge Actif</span>
            </div>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-hidden flex flex-col gap-8">
          {/* Visual Pipeline Flow */}
          <div className="flex items-center justify-between max-w-5xl mx-auto w-full px-12 py-10 relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2 z-0" />
            
            <PipelineNode 
              icon={Monitor} 
              label="Source Locale" 
              active={status === 'uplink'} 
              completed={['downlink', 'forge', 'success'].includes(status)} 
            />
            
            <div className="z-10 flex flex-col items-center gap-2">
              <Github className={cn("w-6 h-6 text-muted-foreground", (status === 'uplink' || status === 'downlink') && "animate-bounce text-primary")} />
              <span className="text-[8px] font-code uppercase text-muted-foreground">Registre Sync</span>
            </div>

            <PipelineNode 
              icon={Hammer} 
              label="Station Build" 
              active={status === 'forge'} 
              completed={status === 'success'} 
            />

            <div className="z-10 flex flex-col items-center gap-2">
              <CheckCircle2 className={cn("w-6 h-6 text-muted-foreground", status === 'success' && "text-secondary")} />
              <span className="text-[8px] font-code uppercase text-muted-foreground">Release</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
            {/* Actions Panel */}
            <Card className="p-6 border-border bg-card/40 flex flex-col gap-6">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                <Zap className="w-4 h-4 text-primary" />
                Actions de Flux
              </h3>
              
              <div className="space-y-4">
                <div className="p-4 border border-border bg-black/20 rounded-sm">
                  <p className="text-[10px] text-muted-foreground font-code uppercase mb-3">&gt; Phase Aval (Pull)</p>
                  <Button 
                    variant="secondary"
                    className="w-full justify-start font-headline text-[10px] h-9 uppercase shadow-lg shadow-secondary/10" 
                    onClick={() => runCommand('pull')}
                    disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5 mr-2", status === 'downlink' && "animate-spin")} />
                    Downlink PC (Pull GitHub)
                  </Button>
                </div>

                <div className="p-4 border border-border bg-black/20 rounded-sm">
                  <p className="text-[10px] text-muted-foreground font-code uppercase mb-3">&gt; Phase Amont (Push)</p>
                  <Button 
                    variant="outline"
                    className="w-full justify-start font-headline text-[10px] h-9 uppercase border-primary/50 text-primary hover:bg-primary/5" 
                    onClick={() => runCommand('web')}
                    disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
                  >
                    <Rocket className={cn("w-3.5 h-3.5 mr-2", status === 'uplink' && "animate-bounce")} />
                    Uplink Source (Push)
                  </Button>
                </div>

                <div className="p-4 border border-primary/20 bg-primary/5 rounded-sm">
                  <p className="text-[10px] text-primary font-bold font-code uppercase mb-3">&gt; Phase Finale (Build)</p>
                  <Button 
                    className="w-full justify-start font-headline text-[10px] h-9 uppercase bg-primary text-primary-foreground" 
                    onClick={() => runCommand('desktop')}
                    disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
                  >
                    <Hammer className={cn("w-3.5 h-3.5 mr-2", status === 'forge' && "animate-pulse")} />
                    Forger Desktop (EXE)
                  </Button>
                </div>
              </div>

              <div className="mt-auto p-3 bg-black/40 rounded-sm border border-border">
                <p className="text-[9px] font-code text-muted-foreground leading-tight uppercase italic">
                  * Assurez-vous que le GITHUB_TOKEN est valide dans votre environnement local pour les transferts.
                </p>
              </div>
            </Card>

            {/* Console Log Panel */}
            <Card className="lg:col-span-2 border-border bg-black p-4 flex flex-col gap-4 shadow-inner shadow-primary/5">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-muted-foreground" />
                  Journaux d'Audit Pipeline
                </h3>
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500/20" />
                  <div className="w-2 h-2 rounded-full bg-yellow-500/20" />
                  <div className="w-2 h-2 rounded-full bg-green-500/20" />
                </div>
              </div>
              
              <ScrollArea className="flex-1 font-code text-[11px] text-foreground/80 leading-relaxed terminal-scroll">
                <pre className="whitespace-pre-wrap">
                  {logs || '> Système en veille. Prêt pour pilotage.'}
                  {status === 'uplink' && '\n📡 TRANSMISSION_SOURCE_EN_COURS...'}
                  {status === 'downlink' && '\n📡 RÉCUPÉRATION_MODIFICATIONS_EN_COURS...'}
                  {status === 'forge' && '\n🏗️ COMPILATION_NATIVE_EN_COURS...'}
                </pre>
              </ScrollArea>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function PipelineNode({ icon: Icon, label, active, completed }: { icon: any, label: string, active: boolean, completed: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 z-10 relative">
      <div className={cn(
        "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-500",
        completed ? "bg-secondary/20 border-secondary text-secondary shadow-[0_0_20px_rgba(46,184,146,0.3)]" :
        active ? "bg-primary/20 border-primary text-primary animate-pulse shadow-[0_0_25px_rgba(50,181,212,0.4)] scale-110" :
        "bg-card border-border text-muted-foreground"
      )}>
        <Icon className="w-6 h-6" />
      </div>
      <span className={cn(
        "text-[10px] font-headline font-bold uppercase tracking-widest text-center",
        active ? "text-primary" : completed ? "text-secondary" : "text-muted-foreground"
      )}>
        {label}
      </span>
    </div>
  );
}
