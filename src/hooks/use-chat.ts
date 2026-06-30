'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ChatMessage } from '@/lib/chat-storage/types';
import { getChatStorage } from '@/lib/chat-storage';
import { isDesktop } from '@/lib/platform';

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

    const userMsg: ChatMessage = { role: 'user', content, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      let data;
      if (isDesktop) {
        const { invoke } = await import('@tauri-apps/api/core');
        data = await invoke('chat_with_ia', { 
          message: content,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        }) as any;
      } else {
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

      const aiMsg: ChatMessage = {
        role: 'model',
        content: data.text,
        provider: data.provider,
        media: data.media,
        procedureId: data.procedureId, // ✅ FIX : Capture de l'ID pour la redirection
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, aiMsg]);
      setCurrentProvider(data.provider);
    } catch (error: any) {
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
    setMessages([]);
    storage.clearHistory();
    setCurrentProvider('VEILLE');
  }, [storage]);

  return { messages, sendMessage, clearChat, isLoading, currentProvider };
}
