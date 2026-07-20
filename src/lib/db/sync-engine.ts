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
  bankSyncedCount: number;
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
      return { injectedCount: 0, vectorizedCount: 0, failedItems: [], skippedDuplicates: 0, purgedCount: 0, bankSyncedCount: 0 };
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
      return { injectedCount: 0, vectorizedCount: 0, failedItems: [], skippedDuplicates: 0, purgedCount: 0, bankSyncedCount: 0 };
    }

    if (items.length === 0) {
      return { injectedCount: 0, vectorizedCount: 0, failedItems: [], skippedDuplicates: 0, purgedCount: 0, bankSyncedCount: 0 };
    }

    let localManifest = await this.getManifest();
    const successIds: string[] = [];
    const failedItems: string[] = [];
    let skippedDuplicates = 0;

    for (const item of items) {
      const maxRetries = 2;
      let injected = false;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (this.isAlreadySynced(localManifest, item.id)) {
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

          localManifest = await this.getManifest();
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
      const manifest = await this.getManifest();
      const toPurge = manifest.files.filter(f => f.cloudId && !activeCloudIds.has(f.cloudId));

      for (const entry of toPurge) {
        try {
          if (isDesktop) {
            await localDBBridge.deleteItem(entry.resolvedPath);
          } else {
            const { localDB } = await import('./local-db');
            await localDB.deleteItem(entry.resolvedPath);
          }
          purgedCount++;
          console.log(`🗑️ [SYNC_PURGE_LOCAL] Élément local supprimé : ${entry.resolvedPath}`);
        } catch (e: any) {
          console.warn(`⚠️ [SYNC_PURGE_LOCAL] Échec suppression ${entry.resolvedPath} :`, e.message);
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
      bankSyncedCount: 0,
    };
  },

  /**
   * Réconciliation bidirectionnelle des champs de configuration (Attributs
   * Personnalisés) entre le cloud Prisma et le Registre Physique offline
   * (.registry/procedure-templates). Déclenchée en hybride EN LIGNE uniquement.
   *  - cloud → offline : upsert des templates cloud absents/localement
   *    périmés dans le registre (par id).
   *  - offline → cloud : push des templates offline pas encore présents
   *    côté cloud (par id).
   * Idempotent (clé = templateId), ne supprime rien.
   */
  async syncConfigFields(localOnly?: boolean): Promise<{ pushedToCloud: number; pulledToLocal: number; failed: string[] }> {
    if (localOnly || typeof window === 'undefined') {
      return { pushedToCloud: 0, pulledToLocal: 0, failed: [] };
    }

    const { listOfflineTemplates, upsertOfflineTemplate, normalizeTemplateOptions } = await import('../procedures/offline-repo');
    const failed: string[] = [];
    let pushedToCloud = 0;
    let pulledToLocal = 0;

    let cloudItems: any[] = [];
    try {
      const res = await apiClient.get<{ success: boolean; items: any[] }>('/api/procedure-config-fields');
      cloudItems = res.items ?? [];
    } catch (e: any) {
      console.warn('[SYNC_CONFIG] Cloud injoignable, repli offline seul :', e.message);
      return { pushedToCloud: 0, pulledToLocal: 0, failed: ['cloud_unreachable'] };
    }

    const cloudById = new Map(cloudItems.map((c) => [c.id, c]));
    const offlineItems = listOfflineTemplates();
    const offlineById = new Map(offlineItems.map((o) => [o.id, o]));

    // cloud → offline : tout template cloud est miroir dans le registre.
    for (const c of cloudItems) {
      try {
        const local = offlineById.get(c.id);
        const cloudUpdated = new Date(c.updatedAt || c.createdAt || 0).getTime();
        const localUpdated = new Date(local?.updatedAt || local?.createdAt || 0).getTime();
        if (!local || cloudUpdated > localUpdated) {
          upsertOfflineTemplate({
            id: c.id,
            name: c.name,
            type: c.type,
            description: c.description ?? null,
            options: normalizeTemplateOptions(c.options),
            required: Boolean(c.required),
            createdAt: c.createdAt || new Date().toISOString(),
            updatedAt: c.updatedAt || new Date().toISOString(),
          });
          pulledToLocal++;
        }
      } catch (e: any) {
        failed.push(`pull:${c.id}`);
      }
    }

    // offline → cloud : push des templates offline absents du cloud.
    for (const o of offlineItems) {
      if (cloudById.has(o.id)) continue;
      try {
        const res = await apiClient.post<any>('/api/procedure-config-fields', {
          name: o.name,
          type: o.type,
          description: o.description ?? undefined,
          options: o.options ?? undefined,
          required: o.required,
        });
        if (res && res.success !== false && !res.error) {
          pushedToCloud++;
          // Aligne l'id offline sur l'id cloud renvoyé (si différent).
          if (res.id && res.id !== o.id) {
            try {
              const { deleteOfflineTemplate } = await import('../procedures/offline-repo');
              deleteOfflineTemplate(o.id);
              upsertOfflineTemplate({ ...o, id: res.id });
            } catch { /* non fatal */ }
          }
        } else {
          failed.push(`push:${o.id}`);
        }
      } catch (e: any) {
        failed.push(`push:${o.id}`);
      }
    }

    console.log(`🔄 [SYNC_CONFIG] pull=${pulledToLocal} push=${pushedToCloud} failed=${failed.length}`);
    return { pushedToCloud, pulledToLocal, failed };
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

  /**
   * Synchronise les actifs de la Banque d'Images (médias) depuis la BDD Web
   * vers la BDD locale. Exécutée uniquement en mode Hybride (online + desktop
   * ou online + web FS writable). Incrémentale : les actifs déjà présents
   * localement sont ignorés (vérification par nom de fichier dans le manifest).
   *
   * Flux pour chaque actif :
   *  1. Récupère la liste des métadonnées depuis /api/bank.
   *  2. Pour chaque actif absent en local, télécharge le binaire via /api/registry.
   *  3. Écrit le binaire et les métadonnées dans .local-db/bank/.
   *  4. Déclenche l'indexation Chroma du fichier metadata.json.
   */
  async syncBankAssets(localOnly?: boolean): Promise<{ synced: number; skipped: number; failed: string[] }> {
    if (localOnly || typeof window === 'undefined') {
      return { synced: 0, skipped: 0, failed: [] };
    }

    const ts = new Date().toLocaleTimeString();
    console.log(`🖼️ [SYNC_BANK] [INIT] [${ts}] Début sync banque de médias.`);

    let cloudItems: any[] = [];
    try {
      const res = await apiClient.get<{ success: boolean; items: any[] }>('/api/bank?limit=500');
      cloudItems = res.items ?? [];
    } catch (e: any) {
      console.warn('[SYNC_BANK] Impossible de récupérer la liste cloud :', e.message);
      return { synced: 0, skipped: 0, failed: ['cloud_bank_unreachable'] };
    }

    if (cloudItems.length === 0) {
      console.log(`🖼️ [SYNC_BANK] Aucun actif cloud à synchroniser.`);
      return { synced: 0, skipped: 0, failed: [] };
    }

    // Récupère la liste locale existante pour éviter les doublons
    const localManifest = await this.getManifest();
    const localBankPaths = new Set(localManifest.files.map(f => f.resolvedPath));

    let synced = 0;
    let skipped = 0;
    const failed: string[] = [];

    for (const item of cloudItems) {
      const safeName = (item.name || '').trim().toLowerCase().replace(/[^a-zA-Z0-9-]/g, '_');
      if (!safeName) { failed.push('invalid_name'); continue; }

      const ext = (item.mime || 'image/jpeg').split('/')[1] || 'jpg';
      const assetRelPath = `bank/${safeName}/${safeName}.${ext}`;
      const metaRelPath  = `bank/${safeName}/metadata.json`;

      // Déjà présent localement → skip
      if (localBankPaths.has(assetRelPath) || localBankPaths.has(metaRelPath)) {
        skipped++;
        console.log(`⏭️ [SYNC_BANK] Actif déjà local : ${safeName}`);
        continue;
      }

      try {
        // Téléchargement du binaire via le Registre cloud
        const assetApiPath = item.path || assetRelPath;
        const assetRes = await apiClient.get<any>(`/api/registry?path=${encodeURIComponent(assetApiPath)}`);
        const binaryData: string | undefined = assetRes?.content ?? assetRes?.data;

        if (!binaryData) {
          console.warn(`⚠️ [SYNC_BANK] Pas de contenu binaire pour : ${safeName}`);
          failed.push(safeName);
          continue;
        }

        const metaContent = JSON.stringify(item, null, 2);

        if (isDesktop) {
          // Mode Desktop (Tauri) : écriture via le bridge qui déclenche le Rust
          // local_db_write — qui décode le Data URI base64 nativement.
          await localDBBridge.writeFile(assetRelPath, binaryData);
          await localDBBridge.writeFile(metaRelPath, metaContent);
        } else {
          // Mode Web (FS Node) : écriture via l'API locale
          const { localDB } = await import('./local-db');
          await localDB.saveBankAsset(`${safeName}/${safeName}.${ext}`, binaryData);
          await localDB.saveBankAsset(`${safeName}/metadata.json`, metaContent);
        }

        // Indexation sémantique locale du fichier metadata.json
        try {
          if (isDesktop) {
            await apiClient.post('/api/local-db', { action: 'index', path: metaRelPath });
          } else {
            const { indexLocalDBFile } = await import('@/lib/local-indexer');
            await indexLocalDBFile(metaRelPath);
          }
        } catch (idxErr: any) {
          console.warn(`⚠️ [SYNC_BANK] Indexation ${safeName} ignorée :`, idxErr.message);
        }

        synced++;
        console.log(`✅ [SYNC_BANK] Actif synchronisé : ${safeName}`);
      } catch (err: any) {
        console.error(`❌ [SYNC_BANK] Échec ${safeName} :`, err.message);
        failed.push(safeName);
      }
    }

    console.log(`🏁 [SYNC_BANK] Terminé. Sync: ${synced}, Skip: ${skipped}, Échecs: ${failed.length}`);
    return { synced, skipped, failed };
  },

  async syncAll(userId: string, projectId: string, localOnly?: boolean): Promise<SyncResult> {
    const state = await this.getSyncState(userId);
    try {
      state.status = 'syncing';
      await this.saveSyncState(state);

      let injectResult: SyncResult = { injectedCount: 0, vectorizedCount: 0, failedItems: [], skippedDuplicates: 0, purgedCount: 0, bankSyncedCount: 0 };
      if (!localOnly) {
        injectResult = await this.downloadAndInjectPhase(userId, projectId, localOnly);
      }

      // Réconciliation des champs de configuration (Attributs Personnalisés)
      // entre cloud et registre offline, en hybride en ligne uniquement.
      let configSync = { pushedToCloud: 0, pulledToLocal: 0, failed: [] as string[] };
      if (!localOnly) {
        try {
          configSync = await this.syncConfigFields(localOnly);
        } catch (e: any) {
          console.warn('[SYNC] Réconciliation config fields échouée (non fatal):', e.message);
        }
      }

      // ── Phase Banque de Médias ─────────────────────────────────────────────
      // Rapatrie les actifs binaires (images/vidéos) de la BDD Web vers la BDD
      // locale. Non bloquant (échec isolé par actif). Uniquement en hybride en
      // ligne : la BDD Web est le silo transitoire avant descente locale.
      let bankSyncedCount = 0;
      if (!localOnly) {
        try {
          const bankResult = await this.syncBankAssets(localOnly);
          bankSyncedCount = bankResult.synced;
          if (bankResult.failed.length > 0) {
            console.warn(`[SYNC] Banque médias : ${bankResult.failed.length} actif(s) en échec.`);
          }
        } catch (e: any) {
          console.warn('[SYNC] Synchronisation banque médias échouée (non fatal):', e.message);
        }
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
        bankSyncedCount,
      };

      console.log(`🏁 [SYNC_COMPLETE] Injection: ${result.injectedCount}, Médias: ${result.bankSyncedCount}, Vectorisation: ${result.vectorizedCount}, Échecs: ${result.failedItems.length}, Doublons ignorés: ${result.skippedDuplicates}.`);
      return result;
    } catch (e: any) {
      state.status = 'error';
      await this.saveSyncState(state);
      throw e;
    }
  }
};
