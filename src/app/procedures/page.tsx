"use client";

import { useState, useEffect } from 'react';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { 
  FileText, 
  Plus, 
  Search, 
  Settings2, 
  AlertCircle, 
  ChevronRight,
  ShieldCheck,
  Zap,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function ProceduresListPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto terminal-scroll">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
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
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="RECHERCHER UN CODE OU TITRE (EX: CRF-START)..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-black/40 font-code uppercase text-xs border-border"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-10 text-[9px] uppercase border-border">
                <Settings2 className="w-3.5 h-3.5 mr-2" /> Filtres
              </Button>
            </div>
          </div>

          {/* Procedures Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Mock Item: Pombe CRF (Referencing our JSON data) */}
            <Card className="p-5 border-primary/20 bg-card/40 hover:border-primary/50 transition-all group cursor-pointer" onClick={() => router.push('/procedures/proc-crf-startup-001')}>
              <div className="flex justify-between items-start mb-4">
                <Badge variant="outline" className="text-[8px] font-code border-primary/40 text-primary uppercase bg-primary/5">
                  CRF-START-001
                </Badge>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
                  <span className="text-[9px] font-bold text-secondary uppercase">Approuvé</span>
                </div>
              </div>
              
              <h3 className="font-headline font-bold text-sm uppercase leading-tight mb-2 group-hover:text-primary transition-colors">
                Démarrage de la pompe CRF - Système de Réfrigération
              </h3>
              
              <div className="space-y-3 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between text-[10px] font-code">
                  <span className="text-muted-foreground uppercase">Département</span>
                  <span className="text-white">Production</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-code">
                  <span className="text-muted-foreground uppercase">Complexité</span>
                  <div className="flex gap-0.5">
                    <div className="w-2 h-1.5 bg-primary rounded-full" />
                    <div className="w-2 h-1.5 bg-primary rounded-full" />
                    <div className="w-2 h-1.5 bg-muted rounded-full" />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <Button size="sm" className="flex-1 h-8 text-[9px] font-bold uppercase bg-secondary text-secondary-foreground" onClick={(e) => { e.stopPropagation(); router.push('/procedures/proc-crf-startup-001/execute'); }}>
                  <Zap className="w-3 h-3 mr-2" /> Exécuter
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </Card>

            {/* Empty States / Templates Placeholder */}
            <Card className="p-5 border-dashed border-border bg-transparent flex flex-col items-center justify-center text-center opacity-40 hover:opacity-100 transition-all">
              <Plus className="w-8 h-8 text-muted-foreground mb-3" />
              <p className="text-[10px] font-code uppercase tracking-widest">Utiliser un Template</p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
