/**
 * @fileOverview Types pour le système de stockage d'historique de chat.
 */

export type ChatMessage = {
  id?: string;
  role: 'user' | 'model';
  content: string;
  provider?: string;
  timestamp: number;
  media?: {
    type: 'image' | 'video';
    url: string;
  };
  procedureId?: string;
  source?: 'voice' | 'text';
  conversationId?: string;
};

export interface ChatStorage {
  saveHistory(messages: ChatMessage[], userId?: string, conversationId?: string): Promise<void>;
  loadHistory(userId?: string, conversationId?: string): Promise<ChatMessage[]>;
  clearHistory(userId?: string, conversationId?: string): Promise<void>;
}
