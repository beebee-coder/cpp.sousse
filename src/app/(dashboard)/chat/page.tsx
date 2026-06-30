"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { ConnectionStatus } from '@/components/dashboard/ConnectionStatus';
import { 
  Send, 
  Bot, 
  User, 
  Cpu, 
  Loader2, 
  Shield, 
  Zap, 
  Trash2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ImageIcon,
  Timer,
  PlayCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useChat } from '@/hooks/use-chat';
import { useVoice } from '@/hooks/use-voice';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function ChatPage() {
  const router = useRouter();
  const { messages, sendMessage, clearChat, isLoading, currentProvider } = useChat();
  const [input, setInput] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoSendTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleSend = useCallback((text: string) => {
    if (text.trim() && !isLoading) {
      sendMessage(text);
      setInput('');
    }
  }, [isLoading, sendMessage]);

  const handleManualSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
    handleSend(input);
  };

  const handleVoiceResult = useCallback((text: string) => {
    setInput(text);
    if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
    if (text.trim() && !isLoading) {
      autoSendTimerRef.current = setTimeout(() => {
        handleSend(text);
        autoSendTimerRef.current = null;
      }, 3000);
    }
  }, [isLoading, handleSend]);

  const voice = useVoice({
    onResult: handleVoiceResult,
    autoRestart: true,
    lang: 'fr-FR'
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (autoSpeak && messages.length > 0 && !isLoading) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'model') {
        voice.speak(lastMsg.content);
      }
    }
  }, [messages, autoSpeak, isLoading, voice.speak]);

  const toggleMic = () => {
    if (voice.isListening) {
      if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
      voice.stopListening();
    } else {
      voice.startListening();
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" /> 
            <Zap className="w-4 h-4 text-primary animate-pulse" />
            <span className="font-headline font-bold text-xs sm:text-sm uppercase tracking-widest text-primary">Groq LPU + Pro-Search</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAutoSpeak(!autoSpeak)} className={cn("h-8 text-[9px] uppercase font-code", autoSpeak ? "text-secondary" : "text-muted-foreground")}>
              {autoSpeak ? <Volume2 className="w-3.5 h-3.5 mr-2" /> : <VolumeX className="w-3.5 h-3.5 mr-2" />}
              <span className="hidden sm:inline">{autoSpeak ? "Audio ON" : "Audio OFF"}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={clearChat} className="h-8 text-[9px] uppercase text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3 h-3 sm:mr-2" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-6 overflow-hidden flex flex-row gap-6 relative">
          <div className="flex-1 flex flex-col gap-4 h-full">
            <ScrollArea className="flex-1 pr-2 sm:pr-4 h-full">
              <div className="space-y-6 pb-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-[60vh] opacity-30 px-4">
                    <Cpu className="w-10 h-10 lg:w-12 lg:h-12 mb-4 text-primary animate-pulse" />
                    <p className="font-code text-[10px] uppercase tracking-widest text-center">Liaison Neurale Active. RAG Multimédia Prêt.</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={cn("flex gap-3 sm:gap-4", m.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                    <div className={cn("w-7 h-7 sm:w-8 sm:h-8 rounded-sm flex items-center justify-center shrink-0 border", m.role === 'user' ? "bg-primary/20 border-primary/50" : "bg-card border-border")}>
                      {m.role === 'user' ? <User className="w-3.5 h-3.5 text-primary" /> : <Bot className="w-3.5 h-3.5 text-secondary" />}
                    </div>
                    <div className={cn("max-w-[90%] sm:max-w-[85%] space-y-2", m.role === 'user' ? "text-right" : "text-left")}>
                      <div className={cn("p-3 sm:p-4 rounded-sm font-code text-[11px] sm:text-sm leading-relaxed border shadow-sm relative group", m.role === 'user' ? "bg-primary/5 border-primary/20" : "bg-card/80 border-border")}>
                        {m.content}
                        
                        {m.procedureId && (
                          <div className="mt-4 p-4 border border-secondary/30 bg-secondary/5 rounded-sm flex flex-col gap-3 animate-in zoom-in-95 duration-500">
                             <div className="flex items-center gap-2">
                               <PlayCircle className="w-5 h-5 text-secondary animate-pulse" />
                               <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Procédure Interactive Détectée</span>
                             </div>
                             <p className="text-[10px] font-code text-muted-foreground uppercase leading-tight">
                               Le moteur de vision a identifié la séquence complète dans le registre. Cliquez ci-dessous pour lancer le cockpit.
                             </p>
                             <Button 
                              onClick={() => router.push(`/procedures/${m.procedureId}/execute`)}
                              className="bg-secondary text-secondary-foreground font-bold uppercase text-[10px] h-10 shadow-xl"
                             >
                               Lancer l'Exécution Réelle
                             </Button>
                          </div>
                        )}

                        {m.media && (
                          <div className="mt-4 border border-primary/20 rounded-sm overflow-hidden bg-black/40 shadow-xl max-w-sm">
                            <div className="p-1 border-b border-primary/10 bg-primary/5 flex items-center gap-2">
                               <ImageIcon className="w-3 h-3 text-primary" />
                               <span className="text-[8px] font-bold text-primary uppercase">Fichier Registre Détecté</span>
                            </div>
                            {m.media.type === 'image' ? (
                              <img src={m.media.url} className="w-full h-auto object-contain max-h-[300px]" alt="RAG Asset" />
                            ) : (
                              <video src={m.media.url} controls className="w-full h-auto max-h-[300px]" />
                            )}
                          </div>
                        )}

                        <div className="mt-3 flex justify-between items-center">
                          <button onClick={() => voice.speak(m.content)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-primary/10 rounded-sm">
                            <Volume2 className="w-3 h-3 text-muted-foreground hover:text-primary" />
                          </button>
                          {m.provider && (
                            <Badge variant="outline" className="text-[8px] bg-background font-code border-primary/30 py-0.5 uppercase text-primary">{m.provider}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            <Card className="p-1.5 sm:p-2 border-primary/30 bg-black/60 shadow-2xl shrink-0">
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  onClick={toggleMic} 
                  disabled={!voice.isSupported || isLoading} 
                  className={cn(
                    "h-9 w-9 sm:h-10 sm:w-10 transition-all", 
                    voice.isListening ? "bg-red-500/20 text-red-500 border border-red-500/50" : "text-primary hover:bg-primary/10"
                  )}
                >
                  {voice.isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
                <Input 
                  value={input} 
                  onChange={(e) => {
                    if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
                    setInput(e.target.value);
                  }} 
                  placeholder={voice.isListening ? "JE VOUS ÉCOUTE..." : (isLoading ? "RÉFLEXION..." : "COMMANDE SYSTÈME OU VOCALE...")} 
                  className="flex-1 bg-transparent border-none focus-visible:ring-0 font-code uppercase text-xs sm:text-sm h-9 sm:h-10" 
                  disabled={isLoading} 
                />
                <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 w-9 sm:h-10 sm:w-10">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </form>
            </Card>
          </div>

          <aside className="w-64 space-y-4 hidden xl:flex flex-col h-full overflow-y-auto terminal-scroll">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-2 shrink-0">Liaison RAG</h3>
            <Card className="p-4 border-secondary/20 bg-secondary/5">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-3.5 h-3.5 text-secondary" />
                <span className="text-[9px] font-code font-bold text-secondary uppercase">Moteur Multimedia</span>
              </div>
              <p className="text-[8px] font-code text-muted-foreground leading-tight uppercase">
                &gt; Indexation : Items + Bank<br/>
                &gt; Mode : Mains Libres<br/>
                &gt; Transition Directe : Actif
              </p>
            </Card>
            <ConnectionStatus service="GROQ" label="Moteur LPU" />
            <ConnectionStatus service="FIREBASE" label="Base d'Audit" />
          </aside>
        </div>
      </main>
    </div>
  );
}
