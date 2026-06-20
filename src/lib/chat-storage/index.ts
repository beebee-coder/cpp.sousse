/**
 * @fileOverview Factory pour le stockage de chat selon la plateforme.
 */
import { isDesktop } from '@/lib/platform';
import { webStorage } from './web';
import { desktopStorage } from './desktop';
import { ChatStorage } from './types';

export function getChatStorage(): ChatStorage {
  return isDesktop ? desktopStorage : webStorage;
}
