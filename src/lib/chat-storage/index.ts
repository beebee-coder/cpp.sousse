/**
 * @fileOverview Factory pour le stockage de chat selon la plateforme.
 */
import { isDesktop } from '@/lib/platform';
import { webStorage } from './web';
import { desktopStorage } from './desktop';
import { ChatStorage } from './types';

const SHARED_HISTORY_KEY = 'visionode_chat_history_shared';

export function getChatStorage(): ChatStorage {
  return isDesktop ? desktopStorage : webStorage;
}

export function getSharedHistoryKey(): string {
  return SHARED_HISTORY_KEY;
}
