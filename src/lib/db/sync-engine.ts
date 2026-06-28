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
   * Enrichit la BDD locale avec les KnowledgeItems de TOUS les utilisateurs approuvés.
   */
  async downloadPhase(userId: string, projectId: string): Promise<number> {
    const state = await this.getSyncState(userId);
    
    let items: any[] = [];
    try {
      const res = await apiClient.post<{ items: any[]; count: number }>('/api/sync/download', {
        userId,
        projectId,
        lastSync: state.lastSync.toISOString(),
        scope: 'all', // Enrichissement cross-users
      });
      items = res.items ?? [];
    } catch (e: any) {
      console.error('⚠️ [SYNC_DOWN] Erreur appel API :', e.message);
      return 0;
    }

    if (items.length === 0) {
      console.log('✅ [SYNC_DOWN] Aucun nouvel item à synchroniser.');
      return 0;
    }

    let indexedCount = 0;

    for (const item of items) {
      try {
        // 🧠 DÉSÉRIALISATION DU CONTENU KNOWLEDGE
        const parsed = typeof item.content === 'string' ? JSON.parse(item.content) : item.content;
        const knowledgeType: string = parsed.type ?? 'qa';
        const title: string = parsed.title ?? 'Sans titre';

        // Construire le texte sémantique selon le type
        let semanticText = '';
        if (knowledgeType === 'qa') {
          semanticText = `${title}\nQuestion: ${parsed.question ?? ''}\nRéponse: ${parsed.answer ?? ''}`;
        } else if (knowledgeType === 'procedure') {
          const steps = Array.isArray(parsed.steps)
            ? parsed.steps.map((s: any, i: number) => `Étape ${i + 1}: ${s.instruction ?? s}`).join('\n')
            : '';
          semanticText = `${title}\n${steps}`;
        }

        // 📦 INDEXATION VECTORIELLE LOCALE (ChromaDB)
        await chromaClient.upsertPoints('knowledge_items', [{
          id: item.id,
          values: [], // L'embedder local génère les vecteurs
          metadata: {
            cloudId: item.id,
            knowledgeId: parsed.knowledgeId ?? item.id,
            type: knowledgeType,
            title,
            tags: item.tags ?? [],
            category: parsed.category ?? '',
            difficulty: parsed.difficulty ?? 'medium',
            origin: 'SYNC_WEB_TO_LOCAL',
            timestamp: new Date(item.createdAt).getTime(),
            syncStatus: 'synced',
          } as any
        }]);

        // 💾 PERSISTANCE LOCALE (SQLite / localStorage)
        await sqliteClient.upsert({
          id: item.id,
          vectorId: item.id,
          key: title,
          value: semanticText,
          syncStatus: 'synced',
        });

        indexedCount++;
        console.log(`📥 [SYNC_DOWN] Indexé : "${title}" (${knowledgeType})`);
      } catch (e: any) {
        console.error(`❌ [SYNC_INDEX] Échec item ${item.id}:`, e.message);
      }
    }

    console.log(`✅ [SYNC_DOWN] ${indexedCount}/${items.length} KnowledgeItems injectés dans ChromaDB local.`);
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