
"use client";

import { DownloadApp } from '@/components/DownloadApp';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function DownloadPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-transparent overflow-hidden">
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <header className="h-16 border-b border-border/70 bg-card/30 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2">
            <div className="lg:hidden w-10" /> {/* Spacer pour le bouton de menu mobile */}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.back()}
              className="text-[9px] sm:text-[10px] font-code uppercase text-muted-foreground hover:text-primary h-8"
            >
              <ArrowLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-2" />
              <span className="hidden sm:inline">Retour</span>
              <span className="sm:hidden">Dashboard</span>
            </Button>
          </div>
          
          <div className="font-code text-[8px] sm:text-[10px] uppercase tracking-widest text-muted-foreground truncate ml-4">
            Registre Central de Distribution
          </div>
        </header>

        <div className="flex-1 overflow-y-auto terminal-scroll p-4 sm:p-8 lg:p-12">
          <div className="max-w-5xl mx-auto">
            <DownloadApp />
          </div>
        </div>

        <footer className="h-12 border-t border-border bg-black/40 flex items-center justify-center gap-4 sm:gap-8 px-6 text-[8px] sm:text-[9px] font-code text-muted-foreground uppercase tracking-widest shrink-0">
          <span className="hidden sm:inline">Licence Industrielle CCP</span>
          <span className="truncate">© 2026 COPILOTE-CCPE PRECISION</span>
          <span className="text-primary/50 hidden md:inline">SHA-256 Validated</span>
        </footer>
      </main>
    </div>
  );
}
