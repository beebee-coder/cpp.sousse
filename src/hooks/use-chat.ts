'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChatMessage } from '@/lib/chat-storage/types';
import { getChatStorage, getSharedHistoryKey } from '@/lib/chat-storage';
import { isDesktop } from '@/lib/platform';
import { useAppMode } from '@/hooks/use-app-mode';
import { useSession } from '@/components/SessionProvider';

interface StreamChunk {
  chunk: string;
  done: boolean;
  result?: {
    text: string;
    provider: string;
  };
}

export function useChat(onAiResponse?: (text: string) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<string>('VEILLE');
  const [isStreaming, setIsStreaming] = useState(false);
  const storage = getChatStorage();
  const { mode, online, localOnly } = useAppMode();
  const { user } = useSession();
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamBufferRef = useRef<string>('');
  const messagesRef = useRef<ChatMessage[]>([]);
  const conversationIdRef = useRef<string>(crypto.randomUUID());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamingEnabled = isDesktop;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const local = await storage.loadHistory(user?.id, conversationIdRef.current);
        if (local.length > 0) setMessages(local);

        if (online && !localOnly && user?.id && conversationIdRef.current) {
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

  /**
   * R4 — Finalise le dernier message modèle du stream natif avec le buffer
   * accumulé. Garantit qu'un message ne reste pas vide si l'event Rust
   * `done` n'arrive pas (flux interrompu). À appeler en fin de invoke.
   */
  const commitNativeMessage = useCallback((provider?: string) => {
    const text = streamBufferRef.current;
    setMessages(prev => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last && last.role === 'model' && !last.content.trim()) {
        last.content = text ? sanitizeOutput(text) : 'Réponse interrompue (flux natif).';
        if (provider) last.provider = provider;
        last.timestamp = Date.now();
      }
      messagesRef.current = updated;
      return updated;
    });
  }, []);

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
        const { listen } = await import('@tauri-apps/api/event');
        
        let nativeStreamUnlisten: (() => void) | undefined;
        try {
          if (streamingEnabled) {
            setIsStreaming(true);
            const aiMsgId = crypto.randomUUID();
            const aiMsg: ChatMessage = {
              id: aiMsgId,
              role: 'model',
              content: '',
              provider: 'Groq LPU + Pro-Search (natif)',
              timestamp: Date.now(),
              conversationId: conversationIdRef.current,
            };
            setMessages(prev => {
              const updated = [...prev, aiMsg];
              messagesRef.current = updated;
              return updated;
            });

            nativeStreamUnlisten = await listen<string>('chat-stream-chunk', (event) => {
              const chunk: StreamChunk = JSON.parse(event.payload);
              if (!chunk.done && chunk.chunk) {
                streamBufferRef.current += chunk.chunk;
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'model') {
                    last.content = streamBufferRef.current;
                  }
                  messagesRef.current = updated;
                  return updated;
                });
              } else if (chunk.done && chunk.result) {
                const resultChunk = chunk.result;
                streamBufferRef.current = resultChunk.text;
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'model') {
                    last.content = sanitizeOutput(resultChunk.text);
                    last.provider = resultChunk.provider;
                    last.timestamp = Date.now();
                  }
                  messagesRef.current = updated;
                  return updated;
                });
              }
            });
          }

          data = await invoke('chat_with_ia', {
            message: sanitized,
            history,
            stream: streamingEnabled,
          }) as any;

          commitNativeMessage((data as any)?.provider);

          if (!streamingEnabled) {
            console.log(`✅ [CHAT] [SUCCESS] Réponse générée par ${(data as any).provider} (natif).`);
          }
        } finally {
          if (nativeStreamUnlisten) {
            nativeStreamUnlisten();
          }
        }
      } else if (isDesktop && mode === 'hybride') {
        console.log(`📡 [CHAT] [STEP] Mode hybride: tentative natif puis fallback cloud.`);
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const { listen } = await import('@tauri-apps/api/event');
          
          let nativeStreamUnlisten: (() => void) | undefined;
          try {
            if (streamingEnabled) {
              setIsStreaming(true);
              const aiMsgId = crypto.randomUUID();
              const aiMsg: ChatMessage = {
                id: aiMsgId,
                role: 'model',
                content: '',
                provider: 'Groq LPU + Pro-Search (natif)',
                timestamp: Date.now(),
                conversationId: conversationIdRef.current,
              };
              setMessages(prev => {
                const updated = [...prev, aiMsg];
                messagesRef.current = updated;
                return updated;
              });

              nativeStreamUnlisten = await listen<string>('chat-stream-chunk', (event) => {
                const chunk: StreamChunk = JSON.parse(event.payload);
                if (!chunk.done && chunk.chunk) {
                  streamBufferRef.current += chunk.chunk;
                  setMessages(prev => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.role === 'model') {
                      last.content = streamBufferRef.current;
                    }
                    messagesRef.current = updated;
                    return updated;
                  });
              } else if (chunk.done && chunk.result) {
                const resultChunk = chunk.result;
                streamBufferRef.current = resultChunk.text;
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'model') {
                    last.content = sanitizeOutput(resultChunk.text);
                    last.provider = resultChunk.provider;
                    last.timestamp = Date.now();
                  }
                    messagesRef.current = updated;
                    return updated;
                  });
                }
              });
            }

            data = await invoke('chat_with_ia', {
              message: sanitized,
              history,
              stream: streamingEnabled,
            }) as any;

            commitNativeMessage((data as any)?.provider);

            if (!streamingEnabled) {
              console.log(`✅ [CHAT] [SUCCESS] Réponse générée par ${(data as any).provider} (natif).`);
            }
          } finally {
            if (nativeStreamUnlisten) {
              nativeStreamUnlisten();
            }
          }
        } catch (nativeError: any) {
          console.warn(`⚠️ [CHAT] [FALLBACK] Natif échoué (${nativeError.message}), bascule cloud...`);
          if (localOnly) {
            throw new Error('Mode local uniquement : bascule cloud désactivée.');
          }
          if (!online) {
            throw new Error('Mode hybride hors-ligne: impossible de basculer vers le cloud.');
          }
          // R3 — transparence : le RAG local Rust n'est pas transmis au cloud,
          // qui reconstruit son propre RAG JS. On signale la dégradation à
          // l'utilisateur plutôt que de basculer silencieusement.
          setCurrentProvider('Groq LPU + Pro-Search (cloud) [fallback natif]');
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
        guideUrl: data.guideUrl,
        executeUrl: data.executeUrl,
        sources: data.sources,
        ragResults: data.ragResults,
        confidence: data.confidence,
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
          last.guideUrl = data.guideUrl;
          last.executeUrl = data.executeUrl;
          last.sources = data.sources;
          last.ragResults = data.ragResults;
          last.confidence = data.confidence;
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
    const fetchPromise = fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Mode': mode,
        'X-Network-Online': online ? '1' : '0',
      },
      body: JSON.stringify({
        message,
        history: messagesRef.current,
        mode,
        stream: true,
        userId: user?.id,
        conversationId: conversationIdRef.current,
        online,
      }),
      signal: abortControllerRef.current?.signal,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Délai de requête cloud dépassé (30s)')), 30000);
    });

    const res = await Promise.race([fetchPromise, timeoutPromise]);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API error ${res.status}: ${errText}`);
    }

    const contentType = res.headers.get('content-type');
    if (contentType?.includes('text/event-stream')) {
      return await handleStreamResponse(res);
    }

    const data = await res.json();
    return {
      text: sanitizeOutput(data.text),
      provider: data.provider,
      model: data.model,
      procedureId: data.procedureId,
      guideUrl: data.guideUrl,
      executeUrl: data.executeUrl,
      sources: data.sources,
      ragResults: data.ragResults,
      confidence: data.confidence,
      media: data.media,
    };
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
    let guideUrl: string | undefined;
    let executeUrl: string | undefined;
    let sources: string[] | undefined;
    let ragResults: any[] | undefined;
    let confidence: 'high' | 'medium' | 'low' | 'none' | undefined;
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
              guideUrl = parsed.result.guideUrl || guideUrl;
              executeUrl = parsed.result.executeUrl || executeUrl;
              sources = parsed.result.sources || sources;
              ragResults = parsed.result.ragResults || ragResults;
              confidence = parsed.result.confidence || confidence;
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
          last.guideUrl = guideUrl;
          last.executeUrl = executeUrl;
          last.sources = sources;
          last.ragResults = ragResults;
          last.confidence = confidence;
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
        guideUrl,
        executeUrl,
        sources,
        ragResults,
        confidence,
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
