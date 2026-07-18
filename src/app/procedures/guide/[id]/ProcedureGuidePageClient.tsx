"use client";

import { useState, useEffect, use } from 'react';
import { ProcedureGuide } from '@/components/procedures/execution/ProcedureGuide';
import {
  ArrowLeft,
  Loader2,
  FileWarning,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

function cn(...classes: (string | boolean | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function ProcedureGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [procedure, setProcedure] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProcedure = async () => {
      setIsLoading(true);
      try {
        const encoded = encodeURIComponent(resolvedParams.id);
        const endpoint = `/api/procedures/guide?code=${encoded}&id=${encoded}`;
        const data = await apiClient.get<any>(endpoint);

        if (data.success && data.procedure) {
          setProcedure(data.procedure);
        } else {
          throw new Error(data.error || 'Procédure introuvable');
        }
      } catch (e: any) {
        setError(e.message || 'Erreur de chargement');
      } finally {
        setIsLoading(false);
      }
    };

    loadProcedure();
  }, [resolvedParams.id]);

  if (isLoading) {
    return (
      <div className="flex h-screen bg-transparent items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="font-code text-xs uppercase tracking-widest text-muted-foreground">Chargement du guide procédural...</p>
        </div>
      </div>
    );
  }

  if (error || !procedure) {
    return (
      <div className="flex h-screen bg-transparent items-center justify-center p-6">
        <Card className="p-8 border-destructive/30 bg-destructive/5 text-center max-w-md">
          <FileWarning className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-headline font-bold uppercase mb-2">Erreur</h2>
          <p className="text-sm text-muted-foreground mb-6">{error || 'Procédure indisponible.'}</p>
          <Button variant="outline" onClick={() => router.push('/procedures')} className="w-full uppercase font-bold text-xs h-10">
            Retour au Registre
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-transparent overflow-hidden">
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="border-b border-border bg-card/30 flex flex-wrap items-center justify-between gap-2 px-4 lg:px-6 py-3 lg:py-0 min-h-16 shrink-0 z-20">
          <div className="flex items-center gap-4 min-w-0">
            <div className="lg:hidden w-10" />
            <Button variant="ghost" size="icon" onClick={() => router.push('/procedures')} className="h-8 w-8 text-muted-foreground hover:text-white shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] leading-tight">Guide IA</span>
              <h1 className="text-xs font-headline font-bold uppercase tracking-tight truncate max-w-[60vw] sm:max-w-[300px] lg:max-w-[500px]">
                {procedure.metadata.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Badge variant="outline" className="text-[8px] font-code border-primary/40 text-primary uppercase">
              {procedure.metadata.code}
            </Badge>
            <Badge variant="outline" className={cn(
              "text-[8px] font-code uppercase",
              procedure.metadata.criticality === 'critical' && "border-destructive/40 text-destructive",
              procedure.metadata.criticality === 'high' && "border-orange-500/40 text-orange-500"
            )}>
              {procedure.metadata.criticality}
            </Badge>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          <ProcedureGuide procedure={procedure} />
        </div>
      </main>
    </div>
  );
}
