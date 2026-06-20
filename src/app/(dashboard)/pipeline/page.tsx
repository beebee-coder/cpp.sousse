
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
  ArrowRight, 
  ShieldCheck, 
  AlertCircle,
  Terminal,
  Zap,
  Hammer
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

type PipelineStep = 'idle' | 'uplink' | 'downlink' | 'forge' | 'success' | 'error';

export default function PipelinePage() {
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
    setLogs(prev => `${prev}\n🚀 [${new Date().toLocaleTimeString()}] INITIATION_${mode.toUpperCase()}...`);

    try {
      const res = await fetch('/api/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      const result = await res.json();
      
      setLogs(prev => `${prev}\n${result.logs}\n${result.errors || ''}`);
      
      if (result.success) {
        setLogs(prev => `${prev}\n✅ [${new Date().toLocaleTimeString()}] OPÉRATION_TERMINÉE_AVEC_SUCCÈS`);
        setStepStatus('success');
      } else {
        setStepStatus('error');
      }
    } catch (err: any) {
      setLogs(prev => `${prev}\n❌ ERREUR_CRITIQUE : ${err.message}`);
      setStepStatus('error');
    }
  };

  if (!isDev) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center p-8 border border-destructive/30 rounded-sm bg-destructive/5">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-headline font-bold text-destructive uppercase">Zone Restreinte</h2>
          <p className="text-sm text-muted-foreground font-code mt-2">Le pilotage du pipeline est disponible uniquement en environnement de développement local.</p>
        </div>
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
              <span className="font-headline font-bold text-sm uppercase tracking-widest">PILOTAGE PIPELINE INDUSTRIEL</span>
            </div>
            <div className="h-4 w-px bg-border mx-2" />
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3 h-3 text-secondary" />
              <span className="text-[10px] font-code text-muted-foreground uppercase tracking-widest">Contrôle de Forge Actif</span>
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
              <ArrowRight className={cn("w-4 h-4 text-muted-foreground", status === 'uplink' && "animate-bounce text-primary")} />
              <span className="text-[8px] font-code uppercase text-muted-foreground">Uplink</span>
            </div>

            <PipelineNode 
              icon={Github} 
              label="Registre GitHub" 
              active={status === 'downlink'} 
              completed={['forge', 'success'].includes(status)} 
            />

            <div className="z-10 flex flex-col items-center gap-2">
              <ArrowRight className={cn("w-4 h-4 text-muted-foreground", status === 'downlink' && "animate-bounce text-secondary")} />
              <span className="text-[8px] font-code uppercase text-muted-foreground">Downlink</span>
            </div>

            <PipelineNode 
              icon={Hammer} 
              label="Station Build PC" 
              active={status === 'forge'} 
              completed={status === 'success'} 
            />

            <div className="z-10 flex flex-col items-center gap-2">
              <ArrowRight className={cn("w-4 h-4 text-muted-foreground", status === 'forge' && "animate-bounce text-primary")} />
              <span className="text-[8px] font-code uppercase text-muted-foreground">Forge</span>
            </div>

            <PipelineNode 
              icon={CheckCircle2} 
              label="Binaire EXE/MSI" 
              active={status === 'success'} 
              completed={status === 'success'} 
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
            {/* Actions Panel */}
            <Card className="p-6 border-primary/20 bg-card/40 flex flex-col gap-6">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Actions de Transformation
              </h3>
              
              <div className="space-y-4">
                <div className="p-4 border border-border bg-black/20 rounded-sm hover:border-primary/30 transition-colors">
                  <p className="text-[10px] text-muted-foreground font-code uppercase mb-2">Phase 1 : Synchronisation</p>
                  <Button 
                    className="w-full justify-start font-headline text-[10px] h-9 uppercase" 
                    onClick={() => runCommand('web')}
                    disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
                  >
                    <Rocket className="w-3.5 h-3.5 mr-2" />
                    Uplink Source (Push)
                  </Button>
                </div>

                <div className="p-4 border border-border bg-black/20 rounded-sm hover:border-secondary/30 transition-colors">
                  <p className="text-[10px] text-muted-foreground font-code uppercase mb-2">Phase 2 : Mise à jour Station</p>
                  <Button 
                    variant="secondary"
                    className="w-full justify-start font-headline text-[10px] h-9 uppercase" 
                    onClick={() => runCommand('pull')}
                    disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-2" />
                    Downlink PC (Pull)
                  </Button>
                </div>

                <div className="p-4 border border-primary/20 bg-primary/5 rounded-sm shadow-[inset_0_0_10px_rgba(50,181,212,0.1)]">
                  <p className="text-[10px] text-primary font-bold font-code uppercase mb-2">Phase Finale : Compilation Native</p>
                  <Button 
                    variant="outline"
                    className="w-full justify-start font-headline text-[10px] h-9 uppercase border-primary/50 text-primary hover:bg-primary/10" 
                    onClick={() => runCommand('desktop')}
                    disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
                  >
                    <Hammer className="w-3.5 h-3.5 mr-2" />
                    Démarrer Forge Desktop
                  </Button>
                </div>
              </div>

              <div className="mt-auto p-3 bg-black/40 rounded-sm border border-border">
                <p className="text-[9px] font-code text-muted-foreground leading-tight uppercase">
                  &gt; Assurez-vous d'avoir configuré le GITHUB_TOKEN dans votre fichier .env local pour les opérations d'Uplink/Downlink.
                </p>
              </div>
            </Card>

            {/* Console Log Panel */}
            <Card className="lg:col-span-2 border-border bg-black p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-muted-foreground" />
                  Journaux d'Audit Pipeline
                </h3>
                <div className="flex gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50" />
                </div>
              </div>
              
              <ScrollArea className="flex-1 font-code text-[11px] text-foreground/80 leading-relaxed terminal-scroll">
                <pre className="whitespace-pre-wrap">
                  {logs || '> Système prêt pour pilotage...'}
                  {status === 'uplink' && '\n📡 TRAVAIL_UPLINK_EN_COURS...'}
                  {status === 'downlink' && '\n📡 TRAVAIL_DOWNLINK_EN_COURS...'}
                  {status === 'forge' && '\n🏗️ TRAVAIL_FORGE_NATIVE_EN_COURS...'}
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
        completed ? "bg-secondary/20 border-secondary text-secondary shadow-[0_0_20px_rgba(46,184,146,0.4)]" :
        active ? "bg-primary/20 border-primary text-primary animate-pulse shadow-[0_0_25px_rgba(50,181,212,0.5)] scale-110" :
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
