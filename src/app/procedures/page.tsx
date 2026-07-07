"use client";

import { useState, useEffect } from 'react';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import {
  FileText,
  Plus,
  Search,
  Settings2,
  ChevronRight,
  ShieldCheck,
  Zap,
  Loader2,
  AlertCircle,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TiltCard } from '@/components/three/TiltCard';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { FullProcedure, ProcedureStep } from '@/lib/procedures/types';

export default function ProceduresListPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [procedures, setProcedures] = useState<FullProcedure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    fetchProcedures();
  }, []);

  const fetchProcedures = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/procedures');
      const data = await res.json();
      if (data.success) {
        setProcedures(data.procedures || []);
      } else {
        throw new Error(data.message || "Erreur de chargement");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProcedures = procedures.filter(p => 
    p.title.toLowerCase().includes(search.toLowerCase()) || 
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  if (!mounted) return null;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-transparent overflow-hidden">
      <DashboardSidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto terminal-scroll">
        <header className="h-16 border-b border-border/70 bg-card/30 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <FileText className="w-4 h-4 text-primary" />
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Registre des Procédures</span>
          </div>
          <Button 
            onClick={() => router.push('/procedures/create')}
            className="bg-primary text-primary-foreground font-bold uppercase text-[10px] h-9 shadow-lg"
          >
            <Plus className="w-3.5 h-3.5 mr-2" /> Nouvelle Procédure
          </Button>
        </header>

        <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="RECHERCHER UN CODE OU TITRE..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-black/40 font-code uppercase text-xs border-border"
              />
            </div>
            <Button variant="outline" size="sm" className="h-10 text-[9px] uppercase border-border" onClick={fetchProcedures}>
              <Settings2 className="w-3.5 h-3.5 mr-2" /> Actualiser
            </Button>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-40">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="font-code text-xs uppercase tracking-widest">Lecture du Registre...</p>
            </div>
          ) : error ? (
            <div className="p-8 border border-destructive/30 bg-destructive/5 rounded-lg text-center">
              <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-4" />
              <p className="text-sm font-code uppercase text-destructive">{error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProcedures.map((proc) => {
                const stepsCount = (proc.steps as unknown as ProcedureStep[])?.length || 0;
                return (
                  <TiltCard
                    className="rounded-xl"
                    onClick={() => router.push(`/procedures/${proc.id}/execute`)}
                  >
                  <Card
                    key={proc.id}
                    glass
                    className="p-5 border-primary/20 hover:border-primary/50 transition-all group cursor-pointer h-full"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <Badge variant="outline" className="text-[8px] font-code border-primary/40 text-primary uppercase bg-primary/5">
                        {proc.code || 'NO-CODE'}
                      </Badge>
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
                        <span className="text-[9px] font-bold text-secondary uppercase">{proc.status || 'DRAFT'}</span>
                      </div>
                    </div>
                    
                    <h3 className="font-headline font-bold text-sm uppercase leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2 min-h-[2.5rem]">
                      {proc.title}
                    </h3>
                    
                    <div className="space-y-3 pt-3 border-t border-border/50">
                      <div className="flex items-center justify-between text-[10px] font-code">
                        <span className="text-muted-foreground uppercase">Criticité</span>
                        <Badge variant="outline" className={cn(
                          "text-[8px] uppercase",
                          proc.criticality === 'CRITICAL' ? "text-red-500 border-red-500/30" : "text-primary border-primary/30"
                        )}>
                          {proc.criticality}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-code">
                        <span className="text-muted-foreground uppercase">Étapes</span>
                        <span className="text-white">{stepsCount}</span>
                      </div>
                    </div>

                    <div className="mt-5 flex gap-2">
                       <Button
                         size="sm"
                         className="flex-1 h-8 text-[9px] font-bold uppercase bg-primary text-primary-foreground"
                         onClick={(e) => {
                           e.stopPropagation();
                           router.push(`/procedures/guide/${proc.code || proc.id}`);
                         }}
                       >
                         <Play className="w-3 h-3 mr-2" /> Guide IA
                       </Button>
                       <Button size="sm" className="flex-1 h-8 text-[9px] font-bold uppercase bg-secondary text-secondary-foreground" onClick={(e) => { e.stopPropagation(); router.push(`/procedures/${proc.id}/execute`); }}>
                         <Zap className="w-3 h-3 mr-2" /> Exécuter
                       </Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={(e) => { e.stopPropagation(); router.push(`/procedures/${proc.id}/edit`); }}>
                         <ChevronRight className="w-4 h-4" />
                       </Button>
                    </div>
                  </Card>
                  </TiltCard>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
