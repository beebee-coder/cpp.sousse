"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Database, 
  Plus, 
  Trash2, 
  FileJson, 
  UploadCloud, 
  ChevronLeft,
  CheckCircle2,
  Cpu,
  Globe
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { usePlatform } from '@/components/PlatformProvider';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';

interface QAItem {
  id: string;
  question: string;
  answer: string;
}

export default function DatasetPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isDesktop } = usePlatform();
  const [items, setItems] = useState<QAItem[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [lastResult, setLastResult] = useState<{ provider: string, count: number } | null>(null);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;

    setItems(prev => [{ id: Date.now().toString(), question, answer }, ...prev]);
    setQuestion('');
    setAnswer('');
  };

  const handleFinalSubmit = async () => {
    if (items.length === 0) return;
    setIsIngesting(true);

    try {
      const res = await apiClient.post<{ success: boolean; message: string; provider: string }>('/api/vector/ingest', {
        filename: `dataset-${Date.now()}.jsonl`,
        items: items.map(i => ({ question: i.question, answer: i.answer })),
        metadata: { collection: 'industrial_manuals', source: 'UI_UPLOAD' }
      });

      if (res.success) {
        toast({
          title: "Succès du RAG",
          description: `${items.length} éléments indexés via ${res.provider}.`,
        });
        setLastResult({ provider: res.provider || 'Inconnu', count: items.length });
        setItems([]);
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto terminal-scroll">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary animate-pulse" />
              <span className="font-headline font-bold text-xs lg:text-sm uppercase tracking-widest text-primary">RAG Hybride</span>
            </div>
            <div className="hidden sm:block h-4 w-px bg-border mx-2" />
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-sm">
              {isDesktop ? <Cpu className="w-3 h-3 text-secondary" /> : <Globe className="w-3 h-3 text-primary" />}
              <span className="text-[9px] font-code uppercase font-bold text-muted-foreground whitespace-nowrap">
                {isDesktop ? "LOCAL (CHROMA)" : "CLOUD (WEAVIATE)"}
              </span>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-4xl mx-auto w-full space-y-6">
          {lastResult && (
            <Card className="p-4 border-secondary/30 bg-secondary/5 flex items-center gap-3 rounded-sm">
              <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
              <div className="font-code text-[10px] lg:text-xs">
                <p className="font-bold uppercase text-secondary">Indexation Réussie</p>
                <p className="text-muted-foreground">{lastResult.count} éléments via <span className="text-primary font-bold">{lastResult.provider}</span></p>
              </div>
            </Card>
          )}

          <Card className="p-4 lg:p-6 border-border bg-card/50 shadow-xl space-y-4 rounded-sm">
            <h3 className="text-[10px] lg:text-xs font-bold uppercase tracking-widest font-headline text-muted-foreground flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              Ajouter une Connaissance
            </h3>
            
            <form onSubmit={handleAddItem} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Question technique..."
                  className="w-full h-24 bg-background/50 border border-border rounded-sm p-3 font-code text-xs uppercase"
                />
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Procédure / Réponse..."
                  className="w-full h-24 bg-background/50 border border-border rounded-sm p-3 font-code text-xs uppercase"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-headline font-bold uppercase text-[10px] h-9 px-6">
                  Ajouter à la file
                </Button>
              </div>
            </form>
          </Card>

          <div className="space-y-4 pb-8">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] lg:text-xs font-bold uppercase tracking-widest font-headline text-muted-foreground">
                File d'attente ({items.length})
              </h3>
              {items.length > 0 && (
                <Button onClick={handleFinalSubmit} disabled={isIngesting} className="bg-secondary text-secondary-foreground font-headline font-bold uppercase text-[10px] h-8">
                  <UploadCloud className="w-3.5 h-3.5 mr-2" />
                  {isIngesting ? "..." : "Synchroniser"}
                </Button>
              )}
            </div>

            {items.length === 0 && !lastResult && (
              <div className="p-12 border border-dashed border-border rounded-sm bg-black/10 text-center opacity-30">
                <FileJson className="w-8 h-8 lg:w-10 lg:h-10 mx-auto mb-2" />
                <p className="font-code text-[9px] lg:text-[10px] uppercase">Aucun élément.</p>
              </div>
            )}

            <div className="space-y-2">
              {items.map((item) => (
                <Card key={item.id} className="p-3 border-border bg-black/20 font-code text-[10px] flex justify-between items-center group rounded-sm">
                  <div className="flex-1 truncate mr-4">
                    <span className="text-primary font-bold mr-2">Q:</span> {item.question}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))} className="h-6 w-6 shrink-0">
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
