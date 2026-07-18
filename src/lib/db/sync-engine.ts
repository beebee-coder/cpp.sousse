import { SyncState } from './types';
import { apiClient } from '../api-client';
import { isDesktop } from '../platform';
import { localDBBridge } from '../local-db-bridge';

interface SyncResult {
  injectedCount: number;
  vectorizedCount: number;
  failedItems: string[];
  skippedDuplicates: number;
  purgedCount: number;
}

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

  async getManifest(): Promise<{ files: { cloudId?: string; resolvedPath: string }[] }> {
    try {
      if (isDesktop) {
        const tree = await localDBBridge.getTree();
        const files: { cloudId?: string; resolvedPath: string }[] = [];
        const walk = (nodes: any[]) => {
          for (const n of nodes) {
            if (n.metadata?.cloudId) files.push({ cloudId: n.metadata.cloudId, resolvedPath: n.id });
            if (n.children) walk(n.children);
          }
        };
        walk(tree);
        return { files };
      }
      const { localDB } = await import('./local-db');
      const manifest = await localDB.getManifest();
      return { files: (manifest.files || []).map((f: any) => ({ cloudId: f.cloudId, resolvedPath: f.resolvedPath })) };
    } catch {
      return { files: [] };
    }
  },

  isAlreadySynced(manifest: { files: { cloudId?: string; resolvedPath: string }[] }, cloudId: string): boolean {
    return manifest.files.some(f => f.cloudId === cloudId);
  },

  async downloadAndInjectPhase(userId: string, projectId: string, localOnly?: boolean): Promise<SyncResult> {
    if (localOnly) {
      return { injectedCount: 0, vectorizedCount: 0, failedItems: [], skippedDuplicates: 0, purgedCount: 0 };
    }

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
      return { injectedCount: 0, vectorizedCount: 0, failedItems: [], skippedDuplicates: 0, purgedCount: 0 };
    }

    if (items.length === 0) {
      return { injectedCount: 0, vectorizedCount: 0, failedItems: [], skippedDuplicates: 0, purgedCount: 0 };
    }

    let manifest = isDesktop ? await localDBBridge.getTree() : [];
    const successIds: string[] = [];
    const failedItems: string[] = [];
    let skippedDuplicates = 0;

    for (const item of items) {
      const maxRetries = 2;
      let injected = false;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (isDesktop) {
            const alreadyInLocal = manifest.some(f => f.id === item.id || f.metadata?.cloudId === item.id);
            if (alreadyInLocal) {
              skippedDuplicates++;
              console.log(`⏭️ [SYNC_SKIP] Item déjà synchronisé : ${item.id}`);
              injected = true;
              break;
            }
          } else if (this.isAlreadySynced(await this.getManifest(), item.id)) {
            skippedDuplicates++;
            console.log(`⏭️ [SYNC_SKIP] Item déjà synchronisé : ${item.id}`);
            injected = true;
            break;
          }

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

          if (isDesktop) {
            await localDBBridge.injectFile(
              fileName,
              JSON.stringify(parsed, null, 2),
              { knowledge_type: knowledgeType, cloud_id: item.id, tags: item.tags || [title] },
              knowledgeType === 'procedure' ? `procedures/${item.id}` : targetDir
            );
          } else {
            await apiClient.post('/api/registry', {
              path: regPath,
              type: 'file',
              content: JSON.stringify(parsed, null, 2)
            });

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
          }

          manifest = isDesktop ? await localDBBridge.getTree() : manifest;
          successIds.push(item.id);
          console.log(`✅ [SYNC_LOCAL_DB] [DONE] Item injecté : ${fileName}`);
          injected = true;
          break;
        } catch (err: any) {
          console.error(`❌ [SYNC_LOCAL_DB] [FAIL] Item ${item.id} tentative ${attempt}/${maxRetries} :`, err.message);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          }
        }
      }

      if (!injected) {
        failedItems.push(item.id);
      }
    }

    // Phase de purge bidirectionnelle : supprimer les éléments locaux absents du cloud
    let purgedCount = 0;
    if (successIds.length > 0) {
      const activeCloudIds = new Set<string>(successIds);

      if (isDesktop) {
        const tree = await localDBBridge.getTree();
        const toPurge = tree.filter(f => f.metadata?.cloudId && !activeCloudIds.has(f.metadata.cloudId));
        for (const entry of toPurge) {
          try {
            await localDBBridge.deleteItem(entry.id);
            purgedCount++;
            console.log(`🗑️ [SYNC_PURGE_LOCAL] Élément local supprimé : ${entry.id}`);
          } catch (e: any) {
            console.warn(`⚠️ [SYNC_PURGE_LOCAL] Échec suppression ${entry.id} :`, e.message);
          }
        }
      } else {
        const manifest = await this.getManifest();
        const toPurge = manifest.files.filter(f => f.cloudId && !activeCloudIds.has(f.cloudId));

        for (const entry of toPurge) {
          try {
            const { localDB } = await import('./local-db');
            await localDB.deleteItem(entry.resolvedPath);
            purgedCount++;
            console.log(`🗑️ [SYNC_PURGE_LOCAL] Élément local supprimé : ${entry.resolvedPath}`);
          } catch (e: any) {
            console.warn(`⚠️ [SYNC_PURGE_LOCAL] Échec suppression ${entry.resolvedPath} :`, e.message);
          }
        }
      }
    }

    // Purge Cloud après injection confirmée (avec retry)
    let cloudPurgedCount = 0;
    if (successIds.length > 0) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const res = await apiClient.post<{ purgedCount?: number }>('/api/sync/cleanup', { ids: successIds, projectId });
          cloudPurgedCount = res.purgedCount || successIds.length;
          console.log(`✅ [SYNC_PURGE] [SUCCESS] ${cloudPurgedCount} items purgés du Cloud.`);
          break;
        } catch (e: any) {
          console.warn(`⚠️ [SYNC_PURGE] [WARN] Tentative ${attempt}/2 échouée :`, e.message);
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    }

    return {
      injectedCount: successIds.length,
      vectorizedCount: 0,
      failedItems,
      skippedDuplicates,
      purgedCount: purgedCount + cloudPurgedCount,
    };
  },

  async vectorizeLocalItems(folder: 'items' | 'procedures' | 'INDEX_CHROMA/items' = 'INDEX_CHROMA/items'): Promise<{ success: boolean; indexed?: number; errors?: string[] }> {
    if (typeof window === 'undefined') return { success: false, errors: ['Server environment'] };
    // La vectorisation via local-indexer s'appuie sur le module Node `fs`, qui
    // n'existe pas en mode web (navigateur). Elle n'est donc possible qu'en
    // poste de bureau (Tauri/Node) où `fs` est disponible. En web, on court-circuite
    // proprement pour ne pas provoquer l'erreur « fs.existsSync is not a function ».
    if (!isDesktop) {
      return { success: true, indexed: 0 };
    }

    try {
      const { indexLocalDBFolder } = await import('@/lib/local-indexer');
      const result = await indexLocalDBFolder(folder);
      return result;
    } catch (e: any) {
      return { success: false, errors: [e.message] };
    }
  },

  async syncAll(userId: string, projectId: string, localOnly?: boolean): Promise<SyncResult> {
    const state = await this.getSyncState(userId);
    try {
      state.status = 'syncing';
      await this.saveSyncState(state);

      let injectResult: SyncResult = { injectedCount: 0, vectorizedCount: 0, failedItems: [], skippedDuplicates: 0, purgedCount: 0 };
      if (!localOnly) {
        injectResult = await this.downloadAndInjectPhase(userId, projectId, localOnly);
      }

      let vectorResult: { success: boolean; indexed?: number; errors?: string[] } = { success: true, indexed: 0 };
      // En mode local pur, la phase de vectorisation (Chroma/embedded) n'est pas
      // relancée à chaque sync : l'indexation est déclenchée à la volée par le
      // frontend (watcher / indexation manuelle) et non par le moteur de sync cloud.
      if (!localOnly) {
        try {
          vectorResult = await this.vectorizeLocalItems('INDEX_CHROMA/items');
        } catch (e: any) {
          console.warn('[SYNC] Vectorisation échouée (non fatal):', e.message);
          vectorResult = { success: false, errors: [e.message] };
        }
      }

      if (vectorResult.success) {
        state.lastSync = new Date();
        state.status = 'idle';
      } else {
        state.status = 'error';
        console.error('[SYNC] Vectorisation échouée, lastSync non mis à jour:', vectorResult.errors);
      }
      state.pendingDownloads = 0;
      await this.saveSyncState(state);

      const result: SyncResult = {
        ...injectResult,
        vectorizedCount: vectorResult.indexed || 0,
      };

      console.log(`🏁 [SYNC_COMPLETE] Injection: ${result.injectedCount}, Vectorisation: ${result.vectorizedCount}, Échecs: ${result.failedItems.length}, Doublons ignorés: ${result.skippedDuplicates}.`);
      return result;
    } catch (e: any) {
      state.status = 'error';
      await this.saveSyncState(state);
      throw e;
    }
  }
};
