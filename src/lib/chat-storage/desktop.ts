/**
 * @fileOverview Implémentation Desktop (Tauri) du stockage de chat.
 * Utilise le stockage persistant de la WebView Tauri.
 */
import { ChatMessage, ChatStorage } from './types';

const STORAGE_KEY = 'visionode_native_chat_history';

export const desktopStorage: ChatStorage = {
  async saveHistory(messages: ChatMessage[]) {
    if (typeof window === 'undefined') return;
    // Tauri persiste le localStorage dans le répertoire AppData de l'utilisateur
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
