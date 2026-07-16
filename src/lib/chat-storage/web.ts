/**
 * @fileOverview Implémentation Web du stockage de chat (localStorage).
 * Identique à desktop.ts : écriture atomique par clé temporaire
 * et recovery sur corruption.
 */
import { ChatMessage, ChatStorage } from './types';
import { getSharedHistoryKey, MAX_MESSAGES } from './index';

export const webStorage: ChatStorage = {
  async saveHistory(messages: ChatMessage[], userId?: string, conversationId?: string) {
    if (typeof window === 'undefined') return;
    const key = getSharedHistoryKey(userId, conversationId);
    const tmpKey = key + '_tmp';

    try {
      const trimmed = messages.slice(-MAX_MESSAGES);
      const payload = JSON.stringify(trimmed);
      localStorage.setItem(tmpKey, payload);
      localStorage.setItem(key, payload);
      localStorage.removeItem(tmpKey);
    } catch (e) {
      console.warn('[CHAT_STORAGE] Web saveHistory failed:', e);
    }
  },
  async loadHistory(userId?: string, conversationId?: string): Promise<ChatMessage[]> {
    if (typeof window === 'undefined') return [];
    const key = getSharedHistoryKey(userId, conversationId);
    const tmpKey = key + '_tmp';

    for (const k of [key, tmpKey]) {
      try {
        const data = localStorage.getItem(k);
        if (data) {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            if (k === tmpKey) {
              try { localStorage.setItem(key, data); } catch {}
              try { localStorage.removeItem(tmpKey); } catch {}
            }
            return parsed;
          }
        }
      } catch {
        // continue to fallback key
      }
    }
    return [];
  },
  async clearHistory(userId?: string, conversationId?: string) {
    if (typeof window === 'undefined') return;
    const key = getSharedHistoryKey(userId, conversationId);
    const tmpKey = key + '_tmp';
    try {
      localStorage.removeItem(key);
      localStorage.removeItem(tmpKey);
    } catch {
      // ignore
    }
  }
};
