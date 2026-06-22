"use client";

import { useState, useRef, useEffect } from 'react';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { ConnectionStatus } from '@/components/dashboard/ConnectionStatus';
import { Send, Bot, User, Cpu, Loader2, Shield, Zap, Info, Activity, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useChat } from '@/hooks/use-chat';
import { cn } from '@/lib/utils';

export default function ChatPage() {
  const { messages, sendMessage, clearChat, isLoading, currentProvider } = useChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" /> {/* Spacer for mobile menu */}
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary animate-pulse" />
              <span className="font-headline font-bold text-xs sm:text-sm uppercase tracking-widest text-primary truncate max-w-[120px] sm:max-w-none">Groq LPU</span>
            </div>
            <div className="hidden sm:block h-4 w-px bg-border mx-2" />
            <div className="hidden sm:flex items-center gap-2">
              <Activity className="w-3 h-3 text-secondary" />
              <span className="text-[9px] lg:text-[10px] font-code text-muted-foreground uppercase tracking-widest truncate max-w-[150px]">
                {currentProvider}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearChat}
              className="h-8 text-[9px] lg:text-[10px] font-code uppercase text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 sm:mr-2" />
              <span className="hidden sm:inline">Réinitialiser</span>
            </Button>
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-sm">
              <Shield className="w-3 h-3 text-secondary" />
              <span className="text-[9px] font-code text-secondary uppercase font-bold tracking-tighter">Sécurisé</span>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-6 overflow-hidden flex flex-row gap-6 relative">
          <div className="flex-1 flex flex-col gap-4 h-full">
            <ScrollArea className="flex-1 pr-2 sm:pr-4 h-full">
              <div className="space-y-6 pb-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-[60vh] opacity-30 px-4">
                    <Cpu className="w-10 h-10 lg:w-12 lg:h-12 mb-4 text-primary animate-pulse" />
                    <p className="font-code text-xs lg:text-sm uppercase tracking-widest text-center max-w-xs leading-relaxed">
                      Liaison Neurale en Attente.<br/>AUDIT_FLUX : ACTIF.
                    </p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={cn(
                    "flex gap-3 sm:gap-4",
                    m.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}>
                    <div className={cn(
                      "w-7 h-7 sm:w-8 sm:h-8 rounded-sm flex items-center justify-center shrink-0 border",
                      m.role === 'user' ? "bg-primary/20 border-primary/50" : "bg-card border-border"
                    )}>
                      {m.role === 'user' ? (
                        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                      ) : (
                        <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-secondary" />
                      )}
                    </div>
                    <div className={cn(
                      "max-w-[90%] sm:max-w-[85%] space-y-2",
                      m.role === 'user' ? "text-right" : "text-left"
                    )}>
                      <div className={cn(
                        "p-3 sm:p-4 rounded-sm font-code text-[11px] sm:text-sm leading-relaxed border shadow-sm relative",
                        m.role === 'user' 
                          ? "bg-primary/5 border-primary/20 text-foreground" 
                          : "bg-card/80 border-border text-foreground"
                      )}>
                        {m.content}
                        {m.provider && (
                          <div className="mt-3 flex justify-end">
                            <Badge variant="outline" className="text-[8px] sm:text-[9px] bg-background font-code border-primary/30 py-0.5 h-5 uppercase text-primary">
                              <Info className="w-2 h-2 sm:w-2.5 sm:h-2.5 mr-1" />
                              {m.provider}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            <Card className="p-1.5 sm:p-2 border-primary/30 bg-black/60 shadow-2xl shrink-0">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isLoading ? "TRAVAIL..." : "COMMANDE SYSTÈME..."}
                  className="flex-1 bg-transparent border-none focus-visible:ring-0 font-code uppercase text-xs sm:text-sm h-9 sm:h-10"
                  disabled={isLoading}
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  disabled={isLoading || !input.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 w-9 sm:h-10 sm:w-10"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </form>
            </Card>
          </div>

          <aside className="w-64 space-y-4 hidden xl:flex flex-col h-full overflow-y-auto terminal-scroll">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-2 shrink-0">Monitor Liaison</h3>
            <ConnectionStatus service="GROQ" label="Moteur LPU" />
            <ConnectionStatus service="GEMINI" label="Multimodal" />
            <ConnectionStatus service="GITHUB" label="Registre Sync" />
            <ConnectionStatus service="FIREBASE" label="Base d'Audit" />
            
            <Card className="p-4 border-primary/20 bg-primary/5 mt-auto">
              <p className="text-[9px] font-code text-primary leading-tight uppercase">
                &gt; Flux chiffrés AES-256.<br/> 
                &gt; Priorité : Groq Llama 3.3.
              </p>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
