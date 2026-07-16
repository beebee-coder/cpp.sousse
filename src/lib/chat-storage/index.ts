/**
 * @fileOverview Factory pour le stockage de chat selon la plateforme.
 */
import { isDesktop } from '@/lib/platform';
import { webStorage } from './web';
import { desktopStorage } from './desktop';
import { ChatStorage } from './types';

const SHARED_HISTORY_KEY = 'visionode_chat_history';
const MAX_MESSAGES = 100;

export function getChatStorage(): ChatStorage {
  return isDesktop ? desktopStorage : webStorage;
}

export function getSharedHistoryKey(userId?: string, conversationId?: string): string {
  const parts = [SHARED_HISTORY_KEY];
  if (userId) parts.push(userId);
  if (conversationId) parts.push(conversationId);
  return parts.join('_');
}

export { MAX_MESSAGES };
