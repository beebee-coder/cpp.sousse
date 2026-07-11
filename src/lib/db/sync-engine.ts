import { SyncState } from './types';
import { apiClient } from '../api-client';

/**
 * @fileOverview Moteur de synchronisation atomique [SYNC_ENGINE].
 * Version : Client-Safe (Suppression des dépendances 'fs' pour éviter l'erreur de bundle).
 *
 * Flux :
 * 1. downloadAndInjectPhase  : télécharge les KnowledgeItems du Cloud et
 *    écrit les fichiers physiques dans le REGISTRE local + INDEX_CHROMA.
 * 2. vectorizeLocalItems    : indexe séparément les fichiers locaux dans
 *    ChromaDB (phase séparée de la synchronisation fichiers).
 */

export const syncEngine = {
  async getSyncState(userId: string): Promise<SyncState> {
    if (typeof window === 'undefined') return {} as SyncState;
    const raw = localStorage.getItem(`visionode_sync_state_${userId}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return { ...parsed, lastSync: new Date(parsed.lastSync) };
      } catch {
        // Ignoré
      }
    }
    return {
      userId,
      deviceId: 'dev-station',
      lastSync: new Date(0),
      pendingUploads: 0,
      pendingDownloads: 0,
      status: 'idle'
    };
  },

  async saveSyncState(state: SyncState) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`visionode_sync_state_${state.userId}`, JSON.stringify(state));
    }
  },

  /**
   * Phase d'Injection : Rapatrie les données du Web et les sécurise localement.
   * Utilise exclusivement apiClient pour communiquer avec le registre physique.
   */
  async downloadAndInjectPhase(userId: string, projectId: string): Promise<number> {
    const ts = new Date().toLocaleTimeString();
    console.log(`📡 [SYNC_DOWN] [INIT] [${ts}] Début de la phase d'injection.`);

    const state = await this.getSyncState(userId);
    let items: any[] = [];

    try {
      const res = await apiClient.post<{ items: any[]; count: number }>('/api/sync/download', {
        userId,
        projectId,
        lastSync: state.lastSync.toISOString(),
        scope: 'all',
      });
      items = res.items ?? [];
    } catch (e: any) {
      console.error(`❌ [SYNC_DOWN] [ERROR] Échec liaison Cloud :`, e.message);
      return 0;
    }

    if (items.length === 0) return 0;

    let successIds: string[] = [];

    for (const item of items) {
      try {
        const parsed = typeof item.content === 'string' ? JSON.parse(item.content) : item.content;
        const knowledgeType = item._knowledgeType || parsed.type || 'qa';
        const title = item._title || parsed.title || 'Sans titre';
        const slug = title
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 40);

        const requestedPath = typeof item._registryPath === 'string' && item._registryPath.trim()
          ? item._registryPath.trim()
          : (typeof parsed.registryPath === 'string' && parsed.registryPath.trim() ? parsed.registryPath.trim() : null);
        const regPath = knowledgeType === 'procedure'
          ? `procedures/${item.id}/procedure.json`
          : (requestedPath || `items/${slug}-${item.id}.json`);
        const registryDir = regPath.split('/').filter(Boolean);
        const fileName = registryDir.length > 1 ? registryDir[registryDir.length - 1] : `${knowledgeType}_${item.id}.json`;
        const targetDir = registryDir.length > 1 ? registryDir.slice(0, -1).join('/') : 'items';

        await apiClient.post('/api/registry', {
          path: regPath,
          type: 'file',
          content: JSON.stringify(parsed, null, 2)
        });

        // 2. Injection dans INDEX_CHROMA via LocalDB avec gestion des doublons
        await apiClient.post('/api/local-db', {
          fileName,
          content: JSON.stringify(parsed, null, 2),
          metadata: {
            knowledgeType,
            cloudId: item.id,
            tags: item.tags || [title]
          },
          targetDir: knowledgeType === 'procedure'
            ? `procedures/${item.id}`
            : targetDir
        });

        successIds.push(item.id);
        console.log(`✅ [SYNC_LOCAL_DB] [DONE] Item injecté dans INDEX_CHROMA : ${fileName}`);
      } catch (err: any) {
        console.error(`❌ [SYNC_LOCAL_DB] [FAIL] Échec item ${item.id} :`, err.message);
      }
    }

    // Purge Cloud après injection confirmée
    if (successIds.length > 0) {
      try {
        await apiClient.post('/api/sync/cleanup', { ids: successIds, projectId });
        console.log(`✅ [SYNC_PURGE] [SUCCESS] Données Web purgées après transfert.`);
      } catch (e: any) {
        console.warn(`⚠️ [SYNC_PURGE] [WARN] Échec purge Cloud :`, e.message);
      }
    }

    return successIds.length;
  },

  /**
   * Phase de vectorisation séparée.
   * Indexe les fichiers locaux du REGISTRE dans ChromaDB.
   * Appelée APRÈS downloadAndInjectPhase pour respecter la séparation des phases.
   */
  async vectorizeLocalItems(folder: 'items' | 'procedures' | 'INDEX_CHROMA/items' = 'INDEX_CHROMA/items'): Promise<{ success: boolean; indexed?: number; errors?: string[] }> {
    if (typeof window === 'undefined') return { success: false, errors: ['Server environment'] };

    try {
      const { indexLocalDBFolder } = await import('@/lib/local-indexer');
      const result = await indexLocalDBFolder(folder);
      return result;
    } catch (e: any) {
      return { success: false, errors: [e.message] };
    }
  },

  async syncAll(userId: string, projectId: string) {
    const state = await this.getSyncState(userId);
    state.status = 'syncing';
    await this.saveSyncState(state);

    try {
      const injectedCount = await this.downloadAndInjectPhase(userId, projectId);

      // Phase de vectorisation séparée
      const vectorResult = await this.vectorizeLocalItems('INDEX_CHROMA/items');

      state.lastSync = new Date();
      state.status = 'idle';
      await this.saveSyncState(state);
      console.log(`🏁 [SYNC_COMPLETE] Injection : ${injectedCount} items, Vectorisation : ${vectorResult.indexed || 0} fichiers.`);
      return { injectedCount, vectorizedCount: vectorResult.indexed || 0 };
    } catch (e: any) {
      state.status = 'error';
      await this.saveSyncState(state);
      throw e;
    }
  }
};
