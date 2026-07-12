"use client";

import { useState, useEffect } from 'react';
import { VideoWall } from '@/components/dashboard/VideoWall';
import { 
  Users, 
  Video, 
  Mic, 
  MicOff, 
  VideoOff, 
  LayoutGrid, 
  Maximize2, 
  Activity,
  ShieldAlert,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function ConferencePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [activeUsers] = useState(4);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-transparent overflow-hidden">
      <main className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header de la salle */}
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-primary animate-pulse" />
              <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Salle de Flux Industriel</span>
            </div>
            <div className="hidden sm:flex items-center gap-3 px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-sm">
              <Users className="w-3.5 h-3.5 text-secondary" />
              <span className="text-[9px] font-code text-secondary uppercase font-bold tracking-tighter">
                {activeUsers} TERMINAUX ACTIFS
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.back()}
              className="text-[10px] uppercase font-code text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-2" /> Retour
            </Button>
            <div className="h-4 w-px bg-border mx-2" />
            <Button variant="outline" size="icon" className="h-8 w-8 border-border">
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </header>

        {/* Zone de Flux Vidéo */}
        <div className="flex-1 p-4 lg:p-6 overflow-hidden bg-black/40">
           <VideoWall isLocalVideoOff={isVideoOff} />
        </div>

        {/* Barre de Contrôle Inférieure */}
        <footer className="h-20 border-t border-border bg-card/50 flex items-center justify-center px-6 shrink-0">
          <div className="flex items-center gap-4">
            <Button 
              variant={isMuted ? "destructive" : "secondary"} 
              size="icon" 
              onClick={() => setIsMuted(!isMuted)}
              className="h-12 w-12 rounded-full shadow-2xl transition-all active:scale-95"
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>

            <Button 
              variant={isVideoOff ? "destructive" : "default"} 
              size="icon"
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={cn(
                "h-14 w-14 rounded-full shadow-[0_0_20px_rgba(50,181,212,0.3)] transition-all active:scale-95",
                isVideoOff ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"
              )}
            >
              {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6 text-primary-foreground" />}
            </Button>

            <Button 
              variant="outline" 
              size="icon"
              className="h-12 w-12 rounded-full border-border/50 text-muted-foreground hover:text-foreground"
            >
              <LayoutGrid className="w-5 h-5" />
            </Button>
          </div>

          <div className="absolute right-8 hidden lg:flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Qualité de Liaison</p>
              <div className="flex gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="w-3 h-1 bg-primary rounded-full shadow-[0_0_5px_rgba(50,181,212,0.5)]" />
                ))}
              </div>
            </div>
            <Activity className="w-5 h-5 text-primary animate-pulse" />
          </div>
        </footer>

        {/* Overlay Alerte Industrielle */}
        <div className="absolute bottom-24 left-8 pointer-events-none opacity-40">
           <div className="flex items-center gap-3 bg-red-600/10 border border-red-600/30 p-2 rounded-sm">
              <ShieldAlert className="w-4 h-4 text-red-600 animate-bounce" />
              <span className="text-[9px] font-code text-red-600 uppercase font-bold tracking-widest">Surveillance de Flux Critique Active</span>
           </div>
        </div>
      </main>
    </div>
  );
}


