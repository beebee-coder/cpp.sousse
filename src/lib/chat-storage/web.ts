/**
 * @fileOverview Implémentation Web du stockage de chat (localStorage).
 * Identique à desktop.ts : écriture atomique par clé temporaire
 * et recovery sur corruption.
 */
import { ChatMessage, ChatStorage, ChatConversation } from './types';
import { getSharedHistoryKey, getConversationsKey, MAX_MESSAGES } from './index';

export const webStorage: ChatStorage = {
  async saveHistory(messages: ChatMessage[], userId?: string, conversationId?: string) {
    if (typeof window === 'undefined') return;
    if (!conversationId) return;
    const key = getSharedHistoryKey(userId, conversationId);
    const tmpKey = key + '_tmp';

    try {
      const trimmed = messages.slice(-MAX_MESSAGES);
      const payload = JSON.stringify(trimmed);
      localStorage.setItem(tmpKey, payload);
      localStorage.setItem(key, payload);
      localStorage.removeItem(tmpKey);

      const idsKey = getConversationsKey(userId);
      let ids: string[] = [];
      try {
        const raw = localStorage.getItem(idsKey);
        if (raw) ids = JSON.parse(raw);
      } catch {}
      if (!Array.isArray(ids)) ids = [];
      if (!ids.includes(conversationId)) {
        ids.push(conversationId);
        localStorage.setItem(idsKey, JSON.stringify(ids));
      }
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
  },
  async listConversations(userId?: string): Promise<ChatConversation[]> {
    if (typeof window === 'undefined') return [];
    const prefix = getSharedHistoryKey(userId) + '_';
    const result: ChatConversation[] = [];
    try {
      const known = new Set<string>();
      const ids = getConversationsKey(userId);
      const stored = localStorage.getItem(ids);
      if (stored) {
        try {
          const arr = JSON.parse(stored) as string[];
          if (Array.isArray(arr)) arr.forEach((id) => known.add(id));
        } catch {}
      }
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          const id = k.slice(prefix.length).replace(/_tmp$/, '');
          if (id && !id.endsWith('_tmp')) known.add(id);
        }
      }
      for (const id of known) {
        const msgs = await this.loadHistory(userId, id);
        if (msgs.length > 0) {
          const firstUser = msgs.find((m) => m.role === 'user' && m.content?.trim());
          const last = msgs[msgs.length - 1];
          result.push({
            id,
            title: firstUser?.content?.trim().slice(0, 40) || `Session ${id.slice(0, 8)}`,
            messageCount: msgs.length,
            updatedAt: last?.timestamp || Date.now(),
            preview: last?.content?.slice(0, 60),
          });
        }
      }
    } catch {
      // ignore
    }
    return result.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async deleteConversation(userId?: string, conversationId?: string) {
    if (typeof window === 'undefined' || !conversationId) return;
    await this.clearHistory(userId, conversationId);
    const ids = getConversationsKey(userId);
    try {
      const stored = localStorage.getItem(ids);
      if (stored) {
        const arr = JSON.parse(stored) as string[];
        const next = (Array.isArray(arr) ? arr : []).filter((id) => id !== conversationId);
        localStorage.setItem(ids, JSON.stringify(next));
      }
    } catch {
      // ignore
    }
  },
};
