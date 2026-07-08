/**
 * @fileOverview Types pour le système de stockage d'historique de chat.
 */

export type ChatMessage = {
  role: 'user' | 'model';
  content: string;
  provider?: string;
  timestamp: number;
  media?: {
    type: 'image' | 'video';
    url: string;
  };
  procedureId?: string;
};

export interface ChatStorage {
  saveHistory(messages: ChatMessage[]): Promise<void>;
  loadHistory(): Promise<ChatMessage[]>;
  clearHistory(): Promise<void>;
}
