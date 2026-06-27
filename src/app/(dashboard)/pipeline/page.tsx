
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
  Terminal,
  Zap,
  Hammer,
  ChevronLeft,
  LucideIcon,
  Package
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type PipelineStep = 'idle' | 'uplink' | 'downlink' | 'forge' | 'success' | 'error';

export default function PipelinePage() {
  const router = useRouter();
  const [status, setStepStatus] = useState<PipelineStep>('idle');
  const [logs, setLogs] = useState<string>('');

  const runCommand = async (mode: 'web' | 'desktop' | 'pull') => {
    const stepMap: Record<string, PipelineStep> = {
      'web': 'uplink',
      'desktop': 'forge',
      'pull': 'downlink'
    };
    
    setStepStatus(stepMap[mode]);
    const timestamp = new Date().toLocaleTimeString();
    
    if (mode === 'desktop') {
      setLogs(prev => `${prev}\n🚀 [${timestamp}] INITIATION_FORGE_RÉELLE...`);
      setLogs(prev => `${prev}\n📡 TRANSFERT DU CODE VERS LA STATION DE COMPILATION GITHUB...`);
    } else {
      setLogs(prev => `${prev}\n🚀 [${timestamp}] INITIATION_${mode.toUpperCase()}...`);
    }

    try {
      // Pour la forge réelle, on force un Push vers GitHub pour activer le workflow
      const res = await fetch('/api/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: mode === 'desktop' ? 'web' : mode }) 
      });
      
      const result = await res.json();
      
      if (result.logs) {
        setLogs(prev => `${prev}\n${result.logs}`);
      }
      if (result.errors) {
        setLogs(prev => `${prev}\n${result.errors}`);
      }
      if (!result.logs && result.message) {
        setLogs(prev => `${prev}\n${result.message}`);
      }
      
      if (result.success) {
        if (mode === 'desktop') {
          setLogs(prev => `${prev}\n✅ [${new Date().toLocaleTimeString()}] UPLINK_RÉUSSI : Compilation GitHub Actions lancée.`);
          setLogs(prev => `${prev}\n📦 Les fichiers .EXE et .MSI seront générés dans 5-10 minutes.`);
        } else {
          setLogs(prev => `${prev}\n✅ [${new Date().toLocaleTimeString()}] OPÉRATION_TERMINÉE`);
        }
        setStepStatus('success');
      } else {
        setLogs(prev => `${prev}\n❌ [${new Date().toLocaleTimeString()}] ÉCHEC : ${result.message || 'Erreur inconnue'}`);
        setStepStatus('error');
      }
    } catch (err: any) {
      setLogs(prev => `${prev}\n❌ [${new Date().toLocaleTimeString()}] ERREUR_LIAISON : ${err.message}`);
      setStepStatus('error');
    }
  };

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
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-sm">
              <ShieldCheck className="w-3 h-3 text-secondary" />
              <span className="text-[9px] font-code text-secondary uppercase font-bold tracking-tighter">Production Active</span>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/dashboard')}
            className="text-[9px] font-code uppercase text-muted-foreground"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />
            Dashboard
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto terminal-scroll">
          <div className="p-4 lg:p-8 flex flex-col gap-6 lg:gap-8 max-w-[1400px] mx-auto w-full">
            
            {/* Visual Pipeline Flow */}
            <div className="relative py-8 lg:py-12 px-4">
              <div className="absolute top-[52px] lg:top-[60px] left-8 right-8 h-0.5 bg-border z-0" />
              
              <div className="relative z-10 flex justify-between items-start gap-4">
                <PipelineNode 
                  icon={Monitor} 
                  label="Local Dev" 
                  active={status === 'uplink'} 
                  completed={['downlink', 'forge', 'success'].includes(status)} 
                />
                
                <div className="flex flex-col items-center gap-2 pt-2">
                  <Github className={cn("w-5 h-5 lg:w-6 lg:h-6 text-muted-foreground transition-all", (status === 'uplink' || status === 'downlink') && "animate-bounce text-primary")} />
                  <span className="text-[7px] lg:text-[8px] font-code uppercase text-muted-foreground hidden sm:block">GitHub Sync</span>
                </div>

                <PipelineNode 
                  icon={Package} 
                  label="CI Build Server" 
                  active={status === 'forge'} 
                  completed={status === 'success'} 
                />

                <div className="flex flex-col items-center gap-2 pt-2">
                  <CheckCircle2 className={cn("w-5 h-5 lg:w-6 lg:h-6 text-muted-foreground transition-all", status === 'success' && "text-secondary")} />
                  <span className="text-[7px] lg:text-[8px] font-code uppercase text-muted-foreground hidden sm:block">Binaires Prêts</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Actions Panel */}
              <div className="space-y-4">
                <h3 className="text-[10px] lg:text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground px-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Flux de Compilation
                </h3>
                
                <div className="grid grid-cols-1 gap-4">
                  <ActionCard 
                    title="Phase Amont (Push)" 
                    description="Sync GitHub" 
                    icon={Rocket} 
                    onClick={() => runCommand('web')}
                    loading={status === 'uplink'}
                    disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
                    variant="outline"
                  />

                  <ActionCard 
                    title="Phase Finale (Release)"
                    description="Forger EXE/MSI" 
                    icon={Hammer} 
                    onClick={() => runCommand('desktop')}
                    loading={status === 'forge'}
                    disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
                    variant="primary"
                  />
                  
                  <ActionCard 
                    title="Phase Aval (Pull)" 
                    description="Downlink Station" 
                    icon={RefreshCw} 
                    onClick={() => runCommand('pull')}
                    loading={status === 'downlink'}
                    disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
                    variant="secondary"
                  />
                </div>

                <Card className="p-4 border-border bg-black/40">
                  <p className="text-[8px] lg:text-[9px] font-code text-muted-foreground leading-tight uppercase italic">
                    * La compilation native est effectuée par GitHub Actions pour garantir des binaires Windows signés et optimisés.
                  </p>
                </Card>
              </div>

              {/* Console Log Panel */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-[10px] lg:text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground px-2">
                  <Terminal className="w-4 h-4 text-muted-foreground" />
                  Journaux de Forge Réelle
                </h3>
                <Card className="border-border bg-black p-4 flex flex-col h-[400px] lg:h-[500px] shadow-inner shadow-primary/5 overflow-hidden">
                  <ScrollArea className="flex-1 font-code text-[10px] lg:text-[11px] text-foreground/80">
                    <pre className="whitespace-pre-wrap py-2">
                      {logs || '> Système prêt pour pilotage de release.'}
                      {status === 'uplink' && '\n📡 TRANSMISSION_SOURCE_EN_COURS...'}
                      {status === 'forge' && '\n🏗️ DÉCLENCHEMENT DE LA COMPILATION NATIVE SUR SERVEUR GITHUB...'}
                    </pre>
                  </ScrollArea>
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
      <button 
        className={cn(
          "w-full flex items-center justify-start font-headline text-[9px] lg:text-[10px] h-9 lg:h-10 uppercase shadow-lg transition-transform active:scale-95 rounded-sm px-4",
          variantClasses[variant as keyof typeof variantClasses],
          (disabled || loading) && "opacity-50 cursor-not-allowed"
        )} 
        onClick={onClick}
        disabled={disabled || loading}
      >
        <Icon className={cn("w-3.5 h-3.5 mr-2", loading && "animate-spin")} />
        {loading ? "TRAVAIL..." : description}
      </button>
    </Card>
  );
}


