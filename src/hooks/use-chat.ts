'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChatMessage } from '@/lib/chat-storage/types';
import { getChatStorage, getSharedHistoryKey } from '@/lib/chat-storage';
import { isDesktop } from '@/lib/platform';
import { useAppMode } from '@/hooks/use-app-mode';
import { useSession } from '@/components/SessionProvider';

export function useChat(onAiResponse?: (text: string) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<string>('VEILLE');
  const [isStreaming, setIsStreaming] = useState(false);
  const storage = getChatStorage();
  const { mode, online } = useAppMode();
  const { user } = useSession();
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamBufferRef = useRef<string>('');
  const messagesRef = useRef<ChatMessage[]>([]);
  const conversationIdRef = useRef<string>(crypto.randomUUID());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const local = await storage.loadHistory(user?.id, conversationIdRef.current);
        if (local.length > 0) setMessages(local);

        if (online && user?.id && conversationIdRef.current) {
          try {
            const res = await fetch(`/api/chat/history?conversationId=${encodeURIComponent(conversationIdRef.current)}`);
            if (res.ok) {
              const data = await res.json();
              if (data.messages && data.messages.length > 0) {
                const cloudMessages = data.messages.map((m: any) => ({
                  id: m.id,
                  role: m.role,
                  content: m.content,
                  provider: m.provider,
                  timestamp: new Date(m.timestamp).getTime(),
                  media: m.media,
                  procedureId: m.procedureId,
                  source: m.source,
                  conversationId: m.conversationId,
                }));
                setMessages(cloudMessages);
                await storage.saveHistory(cloudMessages, user.id, conversationIdRef.current);
              }
            }
          } catch {
            // cloud load failed, keep local
          }
        }
      } catch (e) {
        console.warn('[CHAT] Erreur chargement historique:', e);
      }
    };
    loadHistory();
  }, [storage, user?.id, online]);

  const debouncedSave = useCallback((msgs: ChatMessage[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await storage.saveHistory(msgs, user?.id, conversationIdRef.current);
      } catch (e) {
        console.warn('[CHAT] Erreur sauvegarde historique:', e);
      }
    }, 300);
  }, [storage, user?.id]);

  useEffect(() => {
    if (messages.length > 0) {
      debouncedSave(messages);
    }
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [messages, debouncedSave]);

  const sanitizeInput = (content: string): string => {
    return content
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
      .slice(0, 8000)
      .trim();
  };

  const sanitizeChunk = (text: string): string => {
    return text
      .replace(/<environment_details\b[^>]*>[\s\S]*?<\/environment_details>/gi, '')
      .replace(/<[^>\n]+>/g, '')
      .replace(/\[\s*\]/g, '');
  };

  const sanitizeOutput = (text: string): string => {
    return sanitizeChunk(text).trim();
  };

  const sendMessage = useCallback(async (content: string, source?: 'voice' | 'text') => {
    const sanitized = sanitizeInput(content);
    if (!sanitized || isLoading) return;

    const ts = new Date().toLocaleTimeString();
    console.log(`🤖 [CHAT] [INIT] [${ts}] Envoi message : "${sanitized.slice(0, 30)}..."`);

    const userMsg: ChatMessage = { role: 'user', content: sanitized, timestamp: Date.now(), source, conversationId: conversationIdRef.current };
    setMessages(prev => {
      const next = [...prev, userMsg];
      messagesRef.current = next;
      return next;
    });
    setIsLoading(true);
    setIsStreaming(false);
    streamBufferRef.current = '';

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      let data;
      const history = messagesRef.current.map(m => ({ role: m.role, content: m.content }));

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
        id: crypto.randomUUID(),
        role: 'model',
        content: sanitizeOutput(data.text),
        provider: data.provider,
        media: data.media,
        procedureId: data.procedureId,
        timestamp: Date.now(),
        conversationId: conversationIdRef.current,
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
        messagesRef.current = updated;
        return updated;
      });
      setCurrentProvider(data.provider);
      onAiResponse?.(sanitizeOutput(data.text));
    } catch (error: any) {
      console.error(`❌ [CHAT] [ERROR] Échec liaison :`, error.message);
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        content: `ERREUR_LIAISON_CRITIQUE : ${error.message || 'Le centre de commande est injoignable.'}`,
        timestamp: Date.now(),
        conversationId: conversationIdRef.current,
      };
      setMessages(prev => {
        const updated = [...prev, errMsg];
        messagesRef.current = updated;
        return updated;
      });
      onAiResponse?.(errMsg.content);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [isLoading, storage, onAiResponse, isDesktop, mode, online, user?.id]);

  const callCloudAPI = async (message: string, history: any[], mode: string) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Mode': mode,
      },
      body: JSON.stringify({
        message,
        history: messagesRef.current,
        mode,
        stream: true,
        userId: user?.id,
        conversationId: conversationIdRef.current,
      }),
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
    let procedureId: string | undefined;
    let buffer = '';

    const aiMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'model',
      content: '',
      provider,
      timestamp: Date.now(),
      conversationId: conversationIdRef.current,
    };

    setMessages(prev => {
      const updated = [...prev, aiMsg];
      messagesRef.current = updated;
      return updated;
    });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        let nlIndex: number;
        while ((nlIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nlIndex);
          buffer = buffer.slice(nlIndex + 1);

          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.chunk) {
              const cleanChunk = sanitizeChunk(parsed.chunk);
              fullText += cleanChunk;
              streamBufferRef.current = fullText;
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'model') {
                  last.content = fullText;
                }
                messagesRef.current = updated;
                return updated;
              });
              onAiResponse?.(cleanChunk);
            }
            if (parsed.result) {
              provider = parsed.result.provider || provider;
              model = parsed.result.model || model;
              procedureId = parsed.result.procedureId || procedureId;
            }
          } catch {
            // ignore parse errors on incomplete stream chunks
          }
        }
      }

      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'model') {
          last.content = sanitizeOutput(fullText);
          last.provider = provider;
          last.procedureId = procedureId;
          last.timestamp = Date.now();
        }
        messagesRef.current = updated;
        return updated;
      });

      return {
        text: sanitizeOutput(fullText),
        provider,
        model,
        procedureId,
      };
    } finally {
      reader.releaseLock();
    }
  };

  const clearChat = useCallback(() => {
    console.log(`🗑️ [CHAT] Reset historique.`);
    setMessages([]);
    messagesRef.current = [];
    storage.clearHistory(user?.id, conversationIdRef.current);
    conversationIdRef.current = crypto.randomUUID();
    setCurrentProvider('VEILLE');
  }, [storage, user?.id]);

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
