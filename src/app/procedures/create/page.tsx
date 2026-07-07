"use client";

import { useState, useEffect } from 'react';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { 
  ArrowLeft, 
  Save, 
  AlertTriangle,
  Loader2,
  FilePlus2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DynamicProcedureForm } from '@/components/procedures/forms/DynamicProcedureForm';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function CreateProcedurePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSave = async (data: any) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/procedures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (res.ok) {
        toast({ title: "Procédure enregistrée", description: "L'actif est prêt pour la revue." });
        router.push('/procedures');
      } else {
        throw new Error("Erreur de sauvegarde");
      }
    } catch (e) {
      toast({ title: "Échec", description: "Vérifiez les champs requis.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-transparent overflow-hidden">
      <DashboardSidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <FilePlus2 className="w-4 h-4 text-primary" />
              <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Forge de Procédure</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-sm">
              <AlertTriangle className="w-3 h-3 text-yellow-500" />
              <span className="text-[9px] font-code text-yellow-500 uppercase font-bold">Brouillon</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto terminal-scroll p-4 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <DynamicProcedureForm onSubmit={handleSave} isSaving={isSaving} />
          </div>
        </div>
      </main>
    </div>
  );
}
