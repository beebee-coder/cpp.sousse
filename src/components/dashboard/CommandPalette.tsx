"use client";

import { useState, useEffect } from 'react';
import { Command, Terminal, Zap, Search, Camera, Database } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function CommandPalette() {
  const [input, setInput] = useState('');
  const [showPalette, setShowPalette] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !showPalette) {
        e.preventDefault();
        setShowPalette(true);
      }
      if (e.key === 'Escape') setShowPalette(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPalette]);

  if (!showPalette) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-card border border-primary/30 shadow-2xl rounded-sm overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center px-4 border-b border-border bg-background">
          <Terminal className="w-4 h-4 text-primary mr-3" />
          <Input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="TAPEZ '/' POUR LES COMMANDES..."
            className="border-none focus-visible:ring-0 h-12 bg-transparent font-code uppercase text-sm placeholder:opacity-30"
          />
          <div className="flex items-center gap-1 px-2 py-0.5 border border-border rounded-sm bg-muted/50 text-[10px] font-code text-muted-foreground uppercase">
            ESC POUR ANNULER
          </div>
        </div>
        
        <div className="p-2 bg-card">
          <p className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Commandes Recommandées</p>
          <div className="space-y-1">
            <CommandItem icon={Zap} label="Analyser le Flux Actuel" cmd="/analyse" />
            <CommandItem icon={Search} label="Interroger le Registre RAG" cmd="/recherche" />
            <CommandItem icon={Camera} label="Capturer & Sync Frame" cmd="/sync" />
            <CommandItem icon={Database} label="Indexer Asset Local" cmd="/index" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CommandItem({ icon: Icon, label, cmd }: { icon: any, label: string, cmd: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-sm hover:bg-primary/10 group cursor-pointer transition-colors">
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        <span className="font-headline text-xs uppercase tracking-wider">{label}</span>
      </div>
      <span className="font-code text-[10px] text-muted-foreground group-hover:text-primary">{cmd}</span>
    </div>
  );
}