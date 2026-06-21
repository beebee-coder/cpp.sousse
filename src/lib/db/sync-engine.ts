import { sqliteClient } from './sqlite-client';
import { postgresClient } from './postgres-client';
import { LocalMetadata, CloudData, SyncState } from './types';
import { apiClient } from '../api-client';

// Synchronization engine handling bidirectional sync
export const syncEngine = {
  getSyncState: async (userId: string): Promise<SyncState> => {
    if (typeof window === 'undefined') {
      return {
        userId,
        deviceId: 'server',
        lastSync: new Date(),
        pendingUploads: 0,
        pendingDownloads: 0,
        status: 'idle'
      };
    }
    const raw = localStorage.getItem(`visionode_sync_state_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.lastSync = new Date(parsed.lastSync);
      return parsed;
    }
    
    return {
      userId,
      deviceId: 'dev-station-001',
      lastSync: new Date(0), // Never synced
      pendingUploads: 0,
      pendingDownloads: 0,
      status: 'idle'
    };
  },

  setSyncState: async (state: SyncState): Promise<void> => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`visionode_sync_state_${state.userId}`, JSON.stringify(state));
  },

  /**
   * Run the upload phase of local-to-cloud synchronization.
   * Finds all local items with status 'pending' and uploads them to PostgreSQL.
   */
  uploadPending: async (userId: string, projectId: string): Promise<number> => {
    const metadataList = await sqliteClient.getAll();
    const pendingMetadata = metadataList.filter(m => m.syncStatus === 'pending');
    
    if (pendingMetadata.length === 0) return 0;
    
    const uploadPayload = pendingMetadata.map(meta => ({
      id: meta.id,
      projectId,
      type: 'metadata' as const,
      content: JSON.stringify({ key: meta.key, value: meta.value, vectorId: meta.vectorId }),
      tags: [meta.key],
      createdAt: new Date()
    }));

    const result = await apiClient.post<{ success: boolean }>('/api/sync/upload', {
      userId,
      projectId,
      items: uploadPayload
    });

    if (result.success) {
      for (const meta of pendingMetadata) {
        meta.syncStatus = 'synced';
        await sqliteClient.upsert(meta);
      }
      return pendingMetadata.length;
    } else {
      throw new Error('Upload sync API failed');
    }
  },

  /**
   * Run the download phase of local-to-cloud synchronization.
   * Downloads newer cloud modifications and updates SQLite.
   */
  downloadUpdates: async (userId: string, projectId: string): Promise<number> => {
    const state = await syncEngine.getSyncState(userId);
    
    const result = await apiClient.post<{ items: CloudData[] }>('/api/sync/download', {
      userId,
      projectId,
      lastSync: state.lastSync.toISOString()
    });

    if (!result.items || result.items.length === 0) return 0;

    for (const item of result.items) {
      if (item.type === 'metadata') {
        const parsed = JSON.parse(item.content);
        const meta: LocalMetadata = {
          id: item.id,
          vectorId: parsed.vectorId || 'vector-none',
          key: parsed.key || 'unknown',
          value: parsed.value || '',
          syncStatus: 'synced'
        };
        await sqliteClient.upsert(meta);
      }
    }

    return result.items.length;
  },

  /**
   * Performs a full synchronization cycle: Upload then Download.
   */
  syncAll: async (userId: string, projectId: string): Promise<void> => {
    const state = await syncEngine.getSyncState(userId);
    state.status = 'syncing';
    await syncEngine.setSyncState(state);

    try {
      const uploaded = await syncEngine.uploadPending(userId, projectId);
      const downloaded = await syncEngine.downloadUpdates(userId, projectId);

      state.lastSync = new Date();
      state.pendingUploads = 0;
      state.pendingDownloads = 0;
      state.status = 'idle';
      await syncEngine.setSyncState(state);

      console.log(`🔄 [SYNC_ENGINE] Cycle terminé. Uploads: ${uploaded}, Downloads: ${downloaded}.`);
    } catch (e: any) {
      console.error('❌ [SYNC_ENGINE] Échec de la synchronisation:', e.message);
      state.status = 'error';
      await syncEngine.setSyncState(state);
      throw e;
    }
  }
};
