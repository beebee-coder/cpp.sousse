import { SyncState } from './types';
import { apiClient } from '../api-client';

/**
 * @fileOverview Moteur de synchronisation atomique [SYNC_ENGINE].
 * Version : Client-Safe (Utilise les API Routes au lieu de Node.js 'fs').
 * Flux : Téléchargement Cloud -> Émission vers Registre via API -> Injection Chroma -> Purge Cloud.
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

        // 1. Sauvegarde Registre Physique via API Route (Client-Safe)
        const regPath = knowledgeType === 'procedure' 
          ? `procedures/${item.id}/procedure.json` 
          : `items/${item.id}.json`;
        
        await apiClient.post('/api/registry', {
          path: regPath,
          type: 'file',
          content: JSON.stringify(parsed, null, 2)
        });

        // 2. Vectorisation Locale via API Route (Client-Safe)
        let semanticText = '';
        if (knowledgeType === 'qa') {
          semanticText = `Q: ${parsed.question}\nR: ${parsed.answer}`;
        } else {
          semanticText = `PROCÉDURE: ${title}\nDESCRIPTION: ${parsed.description || ''}`;
        }

        await apiClient.post('/api/vector/documents', {
          collection: 'knowledge_items',
          documents: [{
            id: item.id,
            content: semanticText,
            metadata: { cloudId: item.id, type: knowledgeType, title, timestamp: Date.now() }
          }],
          upsert: true
        });

        successIds.push(item.id);
        console.log(`✅ [SYNC_VECTOR] [DONE] Item injecté localement : ${item.id}`);
      } catch (err: any) {
        console.error(`❌ [SYNC_VECTOR] [FAIL] Échec item ${item.id} :`, err.message);
      }
    }

    // 3. Purge Cloud après injection confirmée
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

  async syncAll(userId: string, projectId: string) {
    const state = await this.getSyncState(userId);
    state.status = 'syncing';
    await this.saveSyncState(state);

    try {
      const injectedCount = await this.downloadAndInjectPhase(userId, projectId);
      state.lastSync = new Date();
      state.status = 'idle';
      await this.saveSyncState(state);
      console.log(`🏁 [SYNC_COMPLETE] Injection terminée : ${injectedCount} items.`);
    } catch (e: any) {
      state.status = 'error';
      await this.saveSyncState(state);
      throw e;
    }
  }
};
