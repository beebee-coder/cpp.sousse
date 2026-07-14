/**
 * @fileOverview Implémentation Web du stockage de chat (localStorage).
 */
import { ChatMessage, ChatStorage } from './types';
import { getSharedHistoryKey } from './index';

export const webStorage: ChatStorage = {
  async saveHistory(messages: ChatMessage[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(getSharedHistoryKey(), JSON.stringify(messages));
  },
  async loadHistory(): Promise<ChatMessage[]> {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(getSharedHistoryKey());
    return data ? JSON.parse(data) : [];
  },
  async clearHistory() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(getSharedHistoryKey());
  }
};
