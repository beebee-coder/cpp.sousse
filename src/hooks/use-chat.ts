'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChatMessage } from '@/lib/chat-storage/types';
import { getChatStorage, getSharedHistoryKey } from '@/lib/chat-storage';
import { isDesktop } from '@/lib/platform';
import { useAppMode } from '@/hooks/use-app-mode';

export function useChat(onAiResponse?: (text: string) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<string>('VEILLE');
  const [isStreaming, setIsStreaming] = useState(false);
  const storage = getChatStorage();
  const { mode, online } = useAppMode();
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamBufferRef = useRef<string>('');

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await storage.loadHistory();
        if (history.length > 0) setMessages(history);
      } catch (e) {
        console.warn('[CHAT] Erreur chargement historique:', e);
      }
    };
    loadHistory();
  }, [storage]);

  useEffect(() => {
    if (messages.length > 0) {
      storage.saveHistory(messages);
    }
  }, [messages, storage]);

  const sanitizeInput = (content: string): string => {
    return content
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
      .slice(0, 8000)
      .trim();
  };

  const sanitizeOutput = (text: string): string => {
    return text
      .replace(/<environment_details>[\s\S]*?<\/environment_details>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
  };

  const sendMessage = useCallback(async (content: string) => {
    const sanitized = sanitizeInput(content);
    if (!sanitized || isLoading) return;

    const ts = new Date().toLocaleTimeString();
    console.log(`🤖 [CHAT] [INIT] [${ts}] Envoi message : "${sanitized.slice(0, 30)}..."`);

    const userMsg: ChatMessage = { role: 'user', content: sanitized, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setIsStreaming(false);
    streamBufferRef.current = '';

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      let data;
      const history = messages.map(m => ({ role: m.role, content: m.content }));

      if (isDesktop && mode === 'locale') {
        console.log(`📡 [CHAT] [STEP] Mode locale: appel Tauri natif uniquement.`);
        const { invoke } = await import('@tauri-apps/api/core');
        data = await invoke('chat_with_ia', {
          message: sanitized,
          history,
        }) as any;
      } else if (isDesktop && mode === 'hybride') {
        console.log(`📡 [CHAT] [STEP] Mode hybride: tentative natif puis fallback cloud.`);
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          data = await invoke('chat_with_ia', {
            message: sanitized,
            history,
          }) as any;
          console.log(`✅ [CHAT] [SUCCESS] Réponse générée par ${data.provider} (natif).`);
        } catch (nativeError: any) {
          console.warn(`⚠️ [CHAT] [FALLBACK] Natif échoué (${nativeError.message}), bascule cloud...`);
          if (!online) {
            throw new Error('Mode hybride hors-ligne: impossible de basculer vers le cloud.');
          }
          data = await callCloudAPI(sanitized, history, mode);
        }
      } else {
        console.log(`📡 [CHAT] [STEP] Appel API Cloud /api/chat.`);
        data = await callCloudAPI(sanitized, history, mode);
      }

      const aiMsg: ChatMessage = {
        role: 'model',
        content: sanitizeOutput(data.text),
        provider: data.provider,
        media: data.media,
        procedureId: data.procedureId,
        timestamp: Date.now()
      };

      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'model') {
          last.content = sanitizeOutput(data.text);
          last.provider = data.provider;
          last.media = data.media;
          last.procedureId = data.procedureId;
          last.timestamp = Date.now();
        } else {
          updated.push(aiMsg);
        }
        return updated;
      });
      setCurrentProvider(data.provider);
      onAiResponse?.(sanitizeOutput(data.text));
    } catch (error: any) {
      console.error(`❌ [CHAT] [ERROR] Échec liaison :`, error.message);
      const errMsg: ChatMessage = {
        role: 'model',
        content: `ERREUR_LIAISON_CRITIQUE : ${error.message || 'Le centre de commande est injoignable.'}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errMsg]);
      onAiResponse?.(errMsg.content);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [messages, isLoading, storage, onAiResponse, isDesktop, mode, online]);

  const callCloudAPI = async (message: string, history: any[], mode: string) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Mode': mode,
      },
      body: JSON.stringify({ message, history, mode, stream: true }),
      signal: abortControllerRef.current?.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API error ${res.status}: ${errText}`);
    }

    const contentType = res.headers.get('content-type');
    if (contentType?.includes('text/event-stream')) {
      return await handleStreamResponse(res);
    }

    return await res.json();
  };

  const handleStreamResponse = async (res: Response): Promise<any> => {
    setIsStreaming(true);
    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('Stream non supporté');
    }

    const decoder = new TextDecoder();
    let fullText = '';
    let provider = 'Groq LPU + Pro-Search (stream)';
    let model = 'llama-3.3-70b-versatile';

    const aiMsg: ChatMessage = {
      role: 'model',
      content: '',
      provider,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, aiMsg]);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.chunk) {
              const cleanChunk = sanitizeOutput(parsed.chunk);
              fullText += cleanChunk;
              streamBufferRef.current = fullText;
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'model') {
                  last.content = fullText;
                }
                return updated;
              });
              onAiResponse?.(cleanChunk);
            }
            if (parsed.result) {
              provider = parsed.result.provider || provider;
              model = parsed.result.model || model;
            }
          } catch {
            // ignore parse errors on stream chunks
          }
        }
      }

      return {
        text: fullText,
        provider,
        model,
      };
    } finally {
      reader.releaseLock();
    }
  };

  const clearChat = useCallback(() => {
    console.log(`🗑️ [CHAT] Reset historique.`);
    setMessages([]);
    storage.clearHistory();
    setCurrentProvider('VEILLE');
  }, [storage]);

  return {
    messages,
    sendMessage,
    clearChat,
    isLoading,
    isStreaming,
    currentProvider,
    mode,
  };
}
