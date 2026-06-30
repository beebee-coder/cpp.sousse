import { sqliteClient } from './sqlite-client';
import { SyncState, LocalMetadata, CloudData } from './types';
import { apiClient } from '../api-client';
import { chromaClient } from './chroma-client';

/**
 * Moteur de synchronisation atomique optimisé pour Neon Postgres & ChromaDB.
 * Version : Vectorisation Obligatoire Post-Sync.
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

  async downloadPhase(userId: string, projectId: string): Promise<number> {
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
      console.error('⚠️ [SYNC_DOWN] Erreur appel API :', e.message);
      return 0;
    }

    if (items.length === 0) return 0;

    let indexedCount = 0;
    for (const item of items) {
      try {
        const parsed = typeof item.content === 'string' ? JSON.parse(item.content) : item.content;
        const knowledgeType: string = parsed.type ?? 'qa';
        const title: string = parsed.title ?? 'Sans titre';

        let semanticText = '';
        if (knowledgeType === 'qa') {
          semanticText = `${title}\nQuestion: ${parsed.question ?? ''}\nRéponse: ${parsed.answer ?? ''}`;
        } else if (knowledgeType === 'procedure') {
          const steps = Array.isArray(parsed.steps)
            ? parsed.steps.map((s: any, i: number) => `Action ${i + 1}: ${s.title || s.instruction || s}`).join('\n')
            : '';
          semanticText = `PROCÉDURE: ${title}\nCONTENU: ${steps}`;
        }

        // 📦 VECTORISATION LOCALE OBLIGATOIRE (ChromaDB)
        await chromaClient.upsertPoints('knowledge_items', [{
          id: item.id,
          values: [], 
          metadata: {
            cloudId: item.id,
            type: knowledgeType,
            title,
            tags: item.tags ?? [],
            category: parsed.category ?? '',
            origin: 'SYNC_AUTO_VECTOR',
            timestamp: new Date(item.createdAt).getTime(),
            syncStatus: 'synced',
          } as any
        }]);

        // 💾 PERSISTANCE LOCALE (SQLite)
        await sqliteClient.upsert({
          id: item.id,
          vectorId: item.id,
          key: title,
          value: semanticText,
          syncStatus: 'synced',
        });

        indexedCount++;
      } catch (e: any) {
        console.error(`❌ [SYNC_VECTOR_FAIL] Échec item ${item.id}:`, e.message);
      }
    }

    return indexedCount;
  },

  async syncAll(userId: string, projectId: string) {
    const state = await this.getSyncState(userId);
    state.status = 'syncing';
    await this.saveSyncState(state);

    try {
      console.log(`🚀 [SYNC] Début de vectorisation automatique...`);
      const upCount = await this.uploadPhase(userId, projectId);
      const downCount = await this.downloadPhase(userId, projectId);

      state.lastSync = new Date();
      state.status = 'idle';
      state.pendingUploads = (await sqliteClient.getPending()).length;
      state.pendingDownloads = 0;
      await this.saveSyncState(state);

      console.log(`✅ [SYNC_SUCCESS] Système vectorisé. Nouveaux index: ${downCount}`);
    } catch (e: any) {
      state.status = 'error';
      await this.saveSyncState(state);
      throw e;
    }
  }
};
