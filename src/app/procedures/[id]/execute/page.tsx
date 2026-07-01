"use client";

import { useState, useEffect, use } from 'react';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { ProcedureExecutor } from '@/components/procedures/execution/ProcedureExecutor';
import { 
  ArrowLeft, 
  Settings2, 
  Share2, 
  Loader2,
  FileWarning
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { FullProcedure } from '@/lib/procedures/types';

export default function ExecuteProcedurePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [procedure, setProcedure] = useState<FullProcedure | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProcedure = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/procedures');
        const data = await response.json();
        
        if (data.success && data.procedures && data.procedures.length > 0) {
          const target = resolvedParams.id 
            ? data.procedures.find((p: any) => p.id === resolvedParams.id) 
            : data.procedures[0];
          
          if (target) {
            setProcedure(target);
          } else {
            throw new Error("Actif introuvable");
          }
        } else {
          throw new Error("Registre vide");
        }
      } catch (e: any) {
        setError(e.message || "Erreur de liaison avec le registre.");
      } finally {
        setIsLoading(false);
      }
    };

    loadProcedure();
  }, [resolvedParams.id]);

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="font-code text-xs uppercase tracking-widest text-muted-foreground">Synchronisation avec le registre industriel...</p>
        </div>
      </div>
    );
  }

  if (error || !procedure) {
    return (
      <div className="flex h-screen bg-background items-center justify-center p-6">
        <Card className="p-8 border-destructive/30 bg-destructive/5 text-center max-w-md">
          <FileWarning className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-headline font-bold uppercase mb-2">Erreur de Registre</h2>
          <p className="text-sm text-muted-foreground mb-6">{error || "La procédure demandée est indisponible."}</p>
          <Button variant="outline" onClick={() => router.push('/procedures')} className="w-full uppercase font-bold text-xs h-10">Retour au Registre</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0 z-20">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <Button variant="ghost" size="icon" onClick={() => router.push('/procedures')} className="h-8 w-8 text-muted-foreground hover:text-white">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] leading-tight">Moteur d'Exécution Actif</span>
              <h1 className="text-xs font-headline font-bold uppercase tracking-tight truncate max-w-[400px]">{procedure.title}</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <Badge variant="outline" className="text-[8px] font-code border-primary/40 text-primary uppercase">{procedure.code}</Badge>
             <div className="h-6 w-px bg-border/50 mx-1" />
             <Button variant="ghost" size="icon" className="h-8 w-8 opacity-50"><Share2 className="w-4 h-4" /></Button>
             <Button variant="ghost" size="icon" className="h-8 w-8"><Settings2 className="w-4 h-4" /></Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto terminal-scroll p-4 lg:p-8 bg-black/20">
          <div className="max-w-[1600px] mx-auto h-full">
            <ProcedureExecutor procedure={procedure} />
          </div>
        </div>
      </main>
    </div>
  );
}
