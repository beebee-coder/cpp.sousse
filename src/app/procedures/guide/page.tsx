"use client";

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  FileText,
  Play,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Search,
  RefreshCw,
  Database,
  HardDrive,
  ChevronRight,
  Zap,
  Shield,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface ProcedureSummary {
  id: string;
  code: string;
  title: string;
  category: string;
  criticality: string;
  steps: number;
  source: 'file' | 'db';
}

export default function ProcedureGuideListPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [procedures, setProcedures] = useState<ProcedureSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadProcedures = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/procedures/guide?list=true');
      const data = await res.json();
      if (data.success && Array.isArray(data.procedures)) {
        const sorted = [...data.procedures].sort((a: ProcedureSummary, b: ProcedureSummary) => {
          if (a.code === 'CRF-START-001') return -1;
          if (b.code === 'CRF-START-001') return 1;
          return a.title.localeCompare(b.title);
        });
        setProcedures(sorted);
      } else {
        throw new Error(data.error || 'Impossible de charger les procédures');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erreur de liaison avec le registre.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) loadProcedures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const getCriticalityConfig = (criticality: string) => {
    switch ((criticality || '').toLowerCase()) {
      case 'critical':
        return { label: 'CRITIQUE', color: 'text-red-500', border: 'border-red-500/40', bg: 'bg-red-500/5', icon: '🔴' };
      case 'high':
        return { label: 'ÉLEVÉ', color: 'text-orange-500', border: 'border-orange-500/40', bg: 'bg-orange-500/5', icon: '🟠' };
      case 'medium':
      case 'normal':
        return { label: 'MOYEN', color: 'text-secondary', border: 'border-secondary/40', bg: 'bg-secondary/5', icon: '🟡' };
      default:
        return { label: (criticality || 'NORMAL').toUpperCase(), color: 'text-primary', border: 'border-primary/40', bg: 'bg-primary/5', icon: '🟢' };
    }
  };

  const filtered = procedures.filter((p) => {
    const q = search.toLowerCase();
    return (
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  if (!mounted) return null;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-transparent overflow-hidden">
      <main className="flex-1 flex flex-col min-w-0 h-full">
        {/* ── Header ── */}
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            {/* Bouton retour arrière */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-white/5 transition-colors shrink-0"
              title="Retour"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>

            <div className="h-4 w-px bg-border" />

            <FileText className="w-4 h-4 text-secondary shrink-0" />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] leading-tight">
                Base RAG
              </span>
              <h1 className="text-xs font-headline font-bold uppercase tracking-widest text-secondary leading-tight">
                Guides Procéduraux
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push('/bdd')}
              className="h-8 text-[10px] uppercase font-bold border-border hover:border-primary/40"
            >
              <HardDrive className="w-3.5 h-3.5 mr-1.5" />
              Station Forge
            </Button>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 terminal-scroll">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* ── Barre de recherche + stats ── */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="RECHERCHER UN CODE, TITRE, CATÉGORIE..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-black/40 font-code uppercase text-[11px] border-border h-9"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-[10px] font-code text-muted-foreground">
                  <Badge variant="outline" className="text-[9px] font-code border-border">
                    {filtered.length} / {procedures.length} guide{procedures.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={loadProcedures}
                  disabled={isLoading}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-white"
                  title="Actualiser"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
                </Button>
              </div>
            </div>

            {/* ── États ── */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-24 opacity-40">
                <Loader2 className="w-10 h-10 animate-spin text-secondary mb-4" />
                <p className="font-code text-xs uppercase tracking-widest">Chargement des guides...</p>
              </div>
            ) : error ? (
              <Card className="p-8 border-destructive/30 bg-destructive/5 text-center max-w-md mx-auto">
                <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-4" />
                <p className="text-sm font-code uppercase text-destructive mb-4">{error}</p>
                <Button size="sm" variant="outline" onClick={loadProcedures} className="text-[10px] uppercase">
                  <RefreshCw className="w-3.5 h-3.5 mr-2" /> Réessayer
                </Button>
              </Card>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 opacity-40">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="font-code text-xs uppercase tracking-widest text-center">
                  {search ? 'Aucun résultat pour cette recherche' : 'Aucune procédure disponible'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filtered.map((proc, idx) => {
                  const crit = getCriticalityConfig(proc.criticality);
                  return (
                    <Card
                      key={proc.id}
                      style={{ animationDelay: `${idx * 60}ms` }}
                      className="relative p-5 border-primary/15 bg-card/40 hover:border-secondary/50 hover:bg-card/60 transition-all group cursor-pointer overflow-hidden animate-fade-up"
                      onClick={() => router.push(`/procedures/guide/${proc.code || proc.id}`)}
                    >
                      {/* Glow accent */}
                      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                      {/* Source badge */}
                      <div className="absolute top-3 right-3">
                        {proc.source === 'file' ? (
                          <span title="Fichier local">
                            <HardDrive className="w-3 h-3 text-muted-foreground/40" />
                          </span>
                        ) : (
                          <span title="Base de données">
                            <Database className="w-3 h-3 text-muted-foreground/40" />
                          </span>
                        )}
                      </div>

                      {/* Header badges */}
                      <div className="flex items-start gap-2 mb-4 pr-6">
                        <Badge
                          variant="outline"
                          className="text-[8px] font-code border-primary/40 text-primary uppercase bg-primary/5 shrink-0"
                        >
                          {proc.code || 'NO-CODE'}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn('text-[8px] font-code uppercase shrink-0', crit.color, crit.border, crit.bg)}
                        >
                          {crit.label}
                        </Badge>
                      </div>

                      {/* Title */}
                      <h3 className="font-headline font-bold text-sm uppercase leading-snug mb-3 group-hover:text-secondary transition-colors line-clamp-2 min-h-[2.5rem]">
                        {proc.title}
                      </h3>

                      {/* Metadata */}
                      <div className="space-y-2 pt-3 border-t border-border/40">
                        <div className="flex items-center justify-between text-[10px] font-code">
                          <span className="text-muted-foreground uppercase">Catégorie</span>
                          <span className="text-white/80 uppercase truncate max-w-[120px]">{proc.category || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-code">
                          <span className="text-muted-foreground uppercase">Étapes</span>
                          <span className="text-primary font-bold">{proc.steps || '—'}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-4 flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-[9px] font-bold uppercase bg-secondary/90 hover:bg-secondary text-secondary-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/procedures/guide/${proc.code || proc.id}`);
                          }}
                        >
                          <Play className="w-3 h-3 mr-1.5" />
                          Lancer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 border-border hover:border-primary/40"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/procedures/${proc.id}`);
                          }}
                          title="Voir les détails"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer stats ── */}
        {!isLoading && !error && procedures.length > 0 && (
          <footer className="border-t border-border bg-card/20 px-6 py-2 shrink-0">
            <div className="flex items-center gap-6 text-[9px] font-code text-muted-foreground uppercase">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-red-500" />
                <span>
                  {procedures.filter((p) => p.criticality?.toLowerCase() === 'critical').length} critique
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-secondary" />
                <span>
                  {procedures.filter((p) => p.source === 'file').length} local
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Database className="w-3 h-3 text-primary" />
                <span>
                  {procedures.filter((p) => p.source === 'db').length} base de données
                </span>
              </div>
            </div>
          </footer>
        )}
      </main>
    </div>
  );
}
