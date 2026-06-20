
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
    <div className="flex h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary animate-pulse" />
              <span className="font-headline font-bold text-sm uppercase tracking-widest text-primary">Priorité Groq LPU</span>
            </div>
            <div className="h-4 w-px bg-border mx-2" />
            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3 text-secondary" />
              <span className="text-[10px] font-code text-muted-foreground uppercase tracking-widest">
                Nœud Actif : {currentProvider}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearChat}
              className="text-[10px] font-code uppercase text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Réinitialiser
            </Button>
            <div className="flex items-center gap-2 px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-sm">
              <Shield className="w-3 h-3 text-secondary" />
              <span className="text-[9px] font-code text-secondary uppercase font-bold tracking-tighter">Liaison Sécurisée</span>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-hidden flex flex-row gap-6">
          <div className="flex-1 flex flex-col gap-4">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-[60vh] opacity-30">
                    <Cpu className="w-12 h-12 mb-4 text-primary animate-pulse" />
                    <p className="font-code text-sm uppercase tracking-widest text-center max-w-xs">
                      Liaison Neurale en Attente. AUDIT_FLUX : ACTIF.
                    </p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={cn(
                    "flex gap-4",
                    m.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}>
                    <div className={cn(
                      "w-8 h-8 rounded-sm flex items-center justify-center shrink-0 border",
                      m.role === 'user' ? "bg-primary/20 border-primary/50" : "bg-card border-border"
                    )}>
                      {m.role === 'user' ? (
                        <User className="w-4 h-4 text-primary" />
                      ) : (
                        <Bot className="w-4 h-4 text-secondary" />
                      )}
                    </div>
                    <div className={cn(
                      "max-w-[85%] space-y-2",
                      m.role === 'user' ? "text-right" : "text-left"
                    )}>
                      <div className={cn(
                        "p-4 rounded-sm font-code text-sm leading-relaxed border shadow-sm relative",
                        m.role === 'user' 
                          ? "bg-primary/5 border-primary/20 text-foreground" 
                          : "bg-card/80 border-border text-foreground"
                      )}>
                        {m.content}
                        {m.provider && (
                          <div className="mt-3 flex justify-end">
                            <Badge variant="outline" className="text-[9px] bg-background font-code border-primary/30 py-0.5 h-5 uppercase text-primary">
                              <Info className="w-2.5 h-2.5 mr-1" />
                              Source : {m.provider}
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

            <Card className="p-2 border-primary/30 bg-black/60 shadow-2xl">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isLoading ? "TRANSMISSION EN COURS..." : "COMMANDE SYSTÈME (EX: STATUT RÉSEAU)..."}
                  className="flex-1 bg-transparent border-none focus-visible:ring-0 font-code uppercase text-sm"
                  disabled={isLoading}
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  disabled={isLoading || !input.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </form>
            </Card>
          </div>

          <aside className="w-64 space-y-4 hidden xl:block">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-2">Monitor de Liaison Cloud</h3>
            <ConnectionStatus service="GROQ" label="Moteur LPU Groq" />
            <ConnectionStatus service="GEMINI" label="Moteur Multimodal" />
            <ConnectionStatus service="GITHUB" label="Registre de Sync" />
            <ConnectionStatus service="FIREBASE" label="Base d'Audit" />
            
            <Card className="p-4 border-primary/20 bg-primary/5 mt-6">
              <p className="text-[9px] font-code text-primary leading-tight uppercase">
                &gt; Tous les flux sont chiffrés via AES-256-GCM. 
                &gt; Priorité de routage : GROQ Llama 3.3.
              </p>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
