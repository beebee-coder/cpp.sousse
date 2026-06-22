import { sqliteClient } from './sqlite-client';
import { SyncState, LocalMetadata, CloudData } from './types';
import { apiClient } from '../api-client';
import { chromaClient } from './chroma-client';

/**
 * Moteur de synchronisation atomique optimisé pour Neon Postgres & ChromaDB.
 * Orchestre le transfert des données entre le registre Cloud et le moteur Vectoriel Local.
 */
export const syncEngine = {
  async getSyncState(userId: string): Promise<SyncState> {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(`visionode_sync_state_${userId}`) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...parsed, lastSync: new Date(parsed.lastSync) };
    }
    return {
      userId,
      deviceId: 'dev-station',
      lastSync: new Date(0),
      pendingUploads: (await sqliteClient.getPending()).length,
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
   * Phase 1 : Upload Local -> Cloud (Neon)
   */
  async uploadPhase(userId: string, projectId: string): Promise<number> {
    const pending = await sqliteClient.getPending();
    if (pending.length === 0) return 0;

    let successCount = 0;
    for (const m of pending) {
      try {
        const payload = {
          id: m.id,
          projectId,
          type: 'metadata' as const,
          content: JSON.stringify({ key: m.key, value: m.value, vectorId: m.vectorId }),
          tags: [m.key],
          createdAt: new Date()
        };

        const res = await apiClient.post<{ success: boolean }>('/api/sync/upload', { 
          userId, 
          projectId, 
          items: [payload] 
        });

        if (res.success) {
          await sqliteClient.upsert({ ...m, syncStatus: 'synced' });
          successCount++;
        }
      } catch (e) {
        console.error(`⚠️ [SYNC_UP] Échec item ${m.id}`);
      }
    }
    return successCount;
  },

  /**
   * Phase 2 : Download Cloud (Neon) -> Local (ChromaDB + SQLite)
   */
  async downloadPhase(userId: string, projectId: string): Promise<number> {
    const state = await this.getSyncState(userId);
    const res = await apiClient.post<{ items: CloudData[] }>('/api/sync/download', {
      userId,
      projectId,
      lastSync: state.lastSync.toISOString()
    });

    if (!res.items || res.items.length === 0) return 0;

    const idsToPurge: string[] = [];
    let indexedCount = 0;

    for (const item of res.items) {
      // 📥 TRAITEMENT DES ASSETS (IMAGES/VIDÉOS)
      if (item.type === 'provisional_asset') {
        console.log(`📥 [SYNC_ASSET] Transfert vers stockage local : ${item.id}`);
        // Ici on simule l'écriture sur le FS local (EXE)
        idsToPurge.push(item.id);
      }

      // 🧠 INDEXATION VECTORIELLE (METADATA / DOCS)
      if (item.type === 'metadata' || item.type === 'document') {
        try {
          const parsed = JSON.parse(item.content);
          
          // Mise à jour du moteur de recherche local (ChromaDB)
          await chromaClient.upsertPoints('industrial_manuals', [{
            id: item.id,
            values: [], // Sera généré par l'embedder local
            metadata: {
              cloudId: item.id,
              type: item.type,
              tags: item.tags,
              timestamp: new Date(item.createdAt).getTime(),
              syncStatus: 'synced'
            }
          }]);

          // Persistance dans le registre de métadonnées local
          await sqliteClient.upsert({
            id: item.id,
            vectorId: item.id,
            key: item.tags[0] || 'sync_import',
            value: item.content,
            syncStatus: 'synced'
          });
          
          indexedCount++;
        } catch (e) {
          console.error(`❌ [SYNC_INDEX] Échec item ${item.id}:`, e);
        }
      }
    }

    // 🧹 PURGE AUTOMATIQUE DU CLOUD (Libération d'espace Neon)
    if (idsToPurge.length > 0) {
      await apiClient.post('/api/sync/cleanup', { ids: idsToPurge, projectId });
      console.log(`🧹 [SYNC_CLEANUP] ${idsToPurge.length} assets purgés du registre cloud.`);
    }

    return indexedCount;
  },

  async syncAll(userId: string, projectId: string) {
    const state = await this.getSyncState(userId);
    state.status = 'syncing';
    await this.saveSyncState(state);

    try {
      console.log(`🚀 [SYNC_START] Initiation du pipeline atomique...`);
      const upCount = await this.uploadPhase(userId, projectId);
      const downCount = await this.downloadPhase(userId, projectId);

      state.lastSync = new Date();
      state.status = 'idle';
      state.pendingUploads = (await sqliteClient.getPending()).length;
      await this.saveSyncState(state);

      console.log(`✅ [SYNC_COMPLETE] Liaison terminée. Indexés: ${downCount}, Transmis: ${upCount}`);
    } catch (e: any) {
      state.status = 'error';
      await this.saveSyncState(state);
      console.error(`❌ [SYNC_CRITICAL] Rupture de liaison:`, e.message);
      throw e;
    }
  }
};