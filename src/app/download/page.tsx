
"use client";

import { DownloadApp } from '@/components/DownloadApp';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function DownloadPage() {
  const router = useRouter();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
            className="text-[10px] font-code uppercase text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-2" />
            Retour
          </Button>
          
          <div className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">
            Registre Central de Distribution
          </div>
        </header>

        <div className="flex-1 overflow-y-auto terminal-scroll p-8 lg:p-12">
          <div className="max-w-5xl mx-auto">
            <DownloadApp />
          </div>
        </div>

        <footer className="h-12 border-t border-border bg-black/40 flex items-center justify-center gap-8 px-6 text-[9px] font-code text-muted-foreground uppercase tracking-widest">
          <span>Licence Industrielle CCP</span>
          <span>© 2026 VISIONODE PRECISION</span>
          <span className="text-primary/50">SHA-256 Validated</span>
        </footer>
      </main>
    </div>
  );
}
