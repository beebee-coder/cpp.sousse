
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ChatMessage } from '@/lib/chat-storage/types';
import { getChatStorage } from '@/lib/chat-storage';
import { isDesktop } from '@/lib/platform';

/**
 * Hook de dialogue VisioNode Core avec logs structurés [CHAT].
 */
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<string>('VEILLE');
  const storage = getChatStorage();

  useEffect(() => {
    storage.loadHistory().then(history => {
      if (history.length > 0) setMessages(history);
    });
  }, [storage]);

  useEffect(() => {
    if (messages.length > 0) {
      storage.saveHistory(messages);
    }
  }, [messages, storage]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const ts = new Date().toLocaleTimeString();
    console.log(`🤖 [CHAT] [INIT] [${ts}] Envoi message : "${content.slice(0, 30)}..."`);

    const userMsg: ChatMessage = { role: 'user', content, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      let data;
      if (isDesktop) {
        console.log(`📡 [CHAT] [STEP] Appel moteur natif Tauri.`);
        const { invoke } = await import('@tauri-apps/api/core');
        data = await invoke('chat_with_ia', { 
          message: content,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        }) as any;
      } else {
        console.log(`📡 [CHAT] [STEP] Appel API Cloud /api/chat.`);
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            history: messages.map(m => ({ role: m.role, content: m.content }))
          })
        });
        if (!res.ok) throw new Error("Réponse API non valide");
        data = await res.json();
      }

      console.log(`✅ [CHAT] [SUCCESS] Réponse générée par ${data.provider}.`);

      const aiMsg: ChatMessage = {
        role: 'model',
        content: data.text,
        provider: data.provider,
        media: data.media,
        procedureId: data.procedureId,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, aiMsg]);
      setCurrentProvider(data.provider);
    } catch (error: any) {
      console.error(`❌ [CHAT] [ERROR] Échec liaison :`, error.message);
      setMessages(prev => [...prev, {
        role: 'model',
        content: "ERREUR_LIAISON_CRITIQUE : Le centre de commande est injoignable.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, storage]);

  const clearChat = useCallback(() => {
    console.log(`🗑️ [CHAT] Reset historique.`);
    setMessages([]);
    storage.clearHistory();
    setCurrentProvider('VEILLE');
  }, [storage]);

  return { messages, sendMessage, clearChat, isLoading, currentProvider };
}
