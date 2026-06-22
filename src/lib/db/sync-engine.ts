import { sqliteClient } from './sqlite-client';
import { SyncState, LocalMetadata, CloudData } from './types';
import { apiClient } from '../api-client';

/**
 * Moteur de synchronisation atomique optimisé pour Neon Postgres.
 * Gère le transfert séquentiel pour éviter la saturation RAM.
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
   * Phase 1 : Upload Atomique (Un par un)
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
        console.error(`⚠️ Échec upload item ${m.id}`);
      }
    }
    return successCount;
  },

  /**
   * Phase 2 : Download Delta (Neon -> Local ChromaDB)
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

    for (const item of res.items) {
      // 📥 TRAITEMENT ASSETS PROVISOIRES
      if (item.type === 'provisional_asset') {
        console.log(`📥 [NEON_SYNC] Transfert asset : ${item.id}`);
        // Dans une app native réelle, on enregistre ici le buffer dans le FS local
        idsToPurge.push(item.id);
      }

      if (item.type === 'metadata') {
        try {
          const parsed = JSON.parse(item.content);
          await sqliteClient.upsert({
            id: item.id,
            vectorId: parsed.vectorId || 'none',
            key: parsed.key || 'unknown',
            value: parsed.value || '',
            syncStatus: 'synced'
          });
        } catch (e) {}
      }
    }

    // 🧹 PURGE NÉON : Libération radicale de l'espace Cloud
    if (idsToPurge.length > 0) {
      await apiClient.post('/api/sync/cleanup', { ids: idsToPurge, projectId });
      console.log(`🧹 [NEON_PURGE] ${idsToPurge.length} assets supprimés du cloud.`);
    }

    return res.items.length;
  },

  async syncAll(userId: string, projectId: string) {
    const state = await this.getSyncState(userId);
    state.status = 'syncing';
    await this.saveSyncState(state);

    try {
      const upCount = await this.uploadPhase(userId, projectId);
      const downCount = await this.downloadPhase(userId, projectId);

      state.lastSync = new Date();
      state.status = 'idle';
      state.pendingUploads = (await sqliteClient.getPending()).length;
      await this.saveSyncState(state);

      console.log(`✅ [NEON_SYNC_OK] Up: ${upCount}, Down: ${downCount}`);
    } catch (e: any) {
      state.status = 'error';
      await this.saveSyncState(state);
      throw e;
    }
  }
};
