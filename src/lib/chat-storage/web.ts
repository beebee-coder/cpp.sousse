/**
 * @fileOverview Implémentation Web du stockage de chat (localStorage).
 */
import { ChatMessage, ChatStorage } from './types';

const STORAGE_KEY = 'visionode_chat_history';

export const webStorage: ChatStorage = {
  async saveHistory(messages: ChatMessage[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  },
  async loadHistory(): Promise<ChatMessage[]> {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },
  async clearHistory() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  }
};
