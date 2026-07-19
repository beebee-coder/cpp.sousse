// src/lib/api-hybrid.ts
import path from 'path';
import { isDesktop } from './platform';
import { localSignIn, upsertLocalUser, validateLocalSession, updateLocalUserProfile } from './local-sql';
import { localAuth } from './auth/local-auth';

const WEB_FETCH_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms = WEB_FETCH_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), ms)
    ),
  ]);
}

/**
 * Registre des intercepteurs Desktop.
 * - Routes purement locales simulées (vector/vision) : réponse mock.
 * - /api/auth/signin : auth locale offline (SQLite embarquée) d'abord,
 *   repli sur le cloud si l'utilisateur n'est pas en local.
 * Toutes les autres routes passent par le fetch réel vers le cloud.
 */
const desktopInterceptors: Record<string, (body: any, webFetch: () => Promise<any>, ctx?: { method?: string; params?: any }) => Promise<any>> = {
  '/api/vector/search': async (body: any) => {
    const localOnly = typeof body?.localOnly === 'boolean'
      ? body.localOnly
      : typeof localStorage !== 'undefined' && localStorage.getItem('visionode-mode-local-only') === '1';

    if (localOnly) {
      try {
        const queryText = body?.query || body?.queryText || '';
        const nResults = body?.nResults || 5;
        if (!queryText.trim()) {
          return { success: true, results: [], provider: 'LOCAL_PERSISTENCE', localOnly: true };
        }
        const { searchAcrossCollections } = await import('./chroma');
        const results = await searchAcrossCollections(queryText, nResults);
        return { success: true, results, provider: 'LOCAL_PERSISTENCE', localOnly: true };
      } catch (e: any) {
        console.error('[HYBRID_BRIDGE] Recherche vectorielle locale échouée:', e.message);
        return { success: false, results: [], provider: 'LOCAL_PERSISTENCE', localOnly: true, error: 'VECTOR_ENGINE_FAILED', message: e.message };
      }
    }

    try {
      const queryText = body?.query || body?.queryText || '';
      const nResults = body?.nResults || 5;
      if (!queryText.trim()) {
        return { success: true, results: [], provider: 'LOCAL_PERSISTENCE' };
      }
      const { searchAcrossCollections } = await import('./chroma');
      const results = await searchAcrossCollections(queryText, nResults);
      return { success: true, results, provider: 'LOCAL_PERSISTENCE' };
    } catch (e: any) {
      console.error('[HYBRID_BRIDGE] Recherche vectorielle locale échouée:', e.message);
      return { success: false, results: [], provider: 'LOCAL_PERSISTENCE', error: 'VECTOR_ENGINE_FAILED', message: e.message };
    }
  },
  '/api/vector/ingest': async (body: any) => {
    const localOnly = typeof body?.localOnly === 'boolean'
      ? body.localOnly
      : typeof localStorage !== 'undefined' && localStorage.getItem('visionode-mode-local-only') === '1';

    if (localOnly) {
      try {
        const { getChromaClient, upsertDocuments } = await import('./chroma');
        const client = await getChromaClient();
        if (!client) {
          return { success: true, message: `${body?.items?.length || 0} éléments sauvegardés dans le cache local.`, provider: 'LOCAL_STORAGE', localOnly: true };
        }
        const collectionName = body?.collection === 'default' ? 'locdb-default' : (body?.collection || 'locdb-default');
        const items = body?.items || [];
        if (items.length > 0) {
          await upsertDocuments(collectionName, items.map((item: any) => ({
            id: item.id || `${collectionName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            content: item.content || item.document || '',
            metadata: item.metadata || {},
          })));
        }
        return { success: true, message: `${items.length} éléments indexés localement.`, provider: 'LOCAL_PERSISTENCE', count: items.length, localOnly: true };
      } catch (e: any) {
        console.error('[HYBRID_BRIDGE] Ingestion vectorielle locale échouée:', e.message);
        return { success: false, message: `Échec indexation: ${e.message}`, provider: 'LOCAL_PERSISTENCE', localOnly: true, error: 'VECTOR_ENGINE_FAILED' };
      }
    }

    try {
      const { getChromaClient, upsertDocuments } = await import('./chroma');
      const client = await getChromaClient();
      if (!client) {
        return { success: true, message: `${body?.items?.length || 0} éléments sauvegardés dans le cache local.`, provider: 'LOCAL_STORAGE' };
      }
      const collectionName = body?.collection === 'default' ? 'locdb-default' : (body?.collection || 'locdb-default');
      const items = body?.items || [];
      if (items.length > 0) {
        await upsertDocuments(collectionName, items.map((item: any) => ({
          id: item.id || `${collectionName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          content: item.content || item.document || '',
          metadata: item.metadata || {},
        })));
      }
      return { success: true, message: `${items.length} éléments indexés localement.`, provider: 'LOCAL_PERSISTENCE', count: items.length };
    } catch (e: any) {
      console.error('[HYBRID_BRIDGE] Ingestion vectorielle locale échouée:', e.message);
      return { success: false, message: `Échec indexation: ${e.message}`, provider: 'LOCAL_PERSISTENCE', error: 'VECTOR_ENGINE_FAILED' };
    }
  },
  // Analyse visuelle : on ne renvoie le mock dégradé QUE si le poste est en
  // mode « Locale uniquement ». En mode Hybride (Tauri en ligne) on relaie
  // l'appel réel vers le cloud (webFetch) pour rester cohérent avec le RAG
  // (/api/vision/retrieval) qui, lui, part réellement vers Groq.
  '/api/vision/description': async (body: any, webFetch: () => Promise<any>) => {
    const localOnly = typeof body?.localOnly === 'boolean'
      ? body.localOnly
      : typeof localStorage !== 'undefined' && localStorage.getItem('visionode-mode-local-only') === '1';

    if (!localOnly) {
      try {
        return await withTimeout(webFetch());
      } catch (e: any) {
        console.warn('[HYBRID_BRIDGE] Vision cloud indisponible → repli mock local:', e?.message);
        // Repli sur le mock dégradé si le cloud est injoignable (réseau coupé).
      }
    }

    return {
      description: "Analyse visuelle simulée (EXE) — mode dégradé sans modèle vision natif.",
      categories: ["Industrie", "Offline"],
      objects: ["Capteur", "Panneau", "Schéma"],
      provider: 'LOCAL_VISION',
      degraded: true,
      offline: true,
      message: "Aucun modèle vision local disponible. Connectez un modèle cloud pour une analyse réelle."
    };
  },
  // RAG visuel : intercepteur symétrique à la description. En mode Locale
  // uniquement (ou cloud injoignable), on renvoie un registre dégradé cohérent
  // au lieu de laisser l'appel échouer sur timeout et bloquer tout le flux.
  '/api/vision/retrieval': async (body: any, webFetch: () => Promise<any>) => {
    const localOnly = typeof body?.localOnly === 'boolean'
      ? body.localOnly
      : typeof localStorage !== 'undefined' && localStorage.getItem('visionode-mode-local-only') === '1';

    if (!localOnly) {
      try {
        return await withTimeout(webFetch());
      } catch (e: any) {
        console.warn('[HYBRID_BRIDGE] RAG visuel cloud indisponible → repli local:', e?.message);
      }
    }

    return {
      componentDescription: "REGISTRE LOCAL (MODE DÉGRADÉ)",
      relevantDocuments: [],
      provider: 'LOCAL_VISION_RAG',
      degraded: true,
      offline: true,
      message: "Aucun registre RAG cloud disponible en mode local."
    };
  },
  // ── Procedure CRUD (offline) ─────────────────────────────────────────────
  // En Desktop offline, l'API Next répond STATIC_EXPORT : on bascule sur le
  // Registre Physique (.registry/procedures/*.json) côté webview. Mode web :
  // cette route n'est pas interceptée (pas d'entrée ici) → fetch cloud normal.
  '/api/procedures': async (body: any, webFetch: () => Promise<any>, ctx?: { method?: string; params?: any }) => {
    const method = ctx?.method || (body && Object.keys(body).length ? 'POST' : 'GET');
    if (method === 'GET') {
      try {
        const { listOfflineProcedures } = await import('./procedures/offline-repo');
        const procs = listOfflineProcedures().map((p: any) => {
          const meta = p.metadata || {};
          return {
            id: p._id,
            code: meta.code || '',
            title: meta.title || 'Sans titre',
            category: meta.category || '',
            criticality: meta.criticality || 'MEDIUM',
            status: 'PUBLISHED',
            metadata: {
              title: meta.title || 'Sans titre',
              code: String(meta.code || '').toUpperCase(),
              category: meta.category || '',
              subcategory: meta.subcategory || '',
              department: meta.department || '',
              criticality: (meta.criticality || 'MEDIUM').toLowerCase(),
              version: meta.version || '1.0.0',
              author: meta.author || { id: 'local', name: 'Local Station', role: 'operator', department: '' },
              approvers: meta.approvers || [],
              tags: meta.tags || [],
              language: meta.language || 'fr',
              createdAt: meta.createdAt || new Date().toISOString(),
              lastUpdated: meta.lastUpdated || new Date().toISOString(),
              description: meta.description || '',
            },
            steps: p.steps || [],
            prerequisites: p.prerequisites || { description: 'Audit standard', items: [] },
            parameters: p.parameters || null,
            mediaLibrary: p.mediaLibrary || null,
            postExecution: p.postExecution || null,
            createdAt: meta.createdAt || new Date().toISOString(),
            updatedAt: meta.lastUpdated || new Date().toISOString(),
            author: { firstName: 'Local', lastName: 'Station' },
          };
        });
        return { success: true, procedures: procs, provider: 'LOCAL_REGISTRY', offline: true };
      } catch (e: any) {
        return { success: false, procedures: [], error: 'LECTURE_REGISTRE_ECHEC', message: e.message };
      }
    }
    // POST (création)
    try {
      const { CreateProcedureSchema } = await import('./procedures/validators/procedure.validator');
      const parsed = CreateProcedureSchema.safeParse(body || {});
      if (!parsed.success) {
        return { success: false, error: 'VALIDATION_ERROR', message: 'Validation échouée', errors: parsed.error.flatten() };
      }
      const data = parsed.data;
      const { upsertOfflineProcedure } = await import('./procedures/offline-repo');
      const now = new Date().toISOString();
      const code = (data.code || `PROC-${Date.now().toString().slice(-6)}`).toUpperCase();
      const record: any = {
        _id: `${code}-${Date.now().toString(36)}`,
        _version: '1.0.0',
        _type: 'industrial_procedure',
        metadata: {
          title: data.title,
          code,
          category: data.category.toUpperCase(),
          criticality: data.criticality || 'MEDIUM',
          version: '1.0.0',
          createdAt: now,
          lastUpdated: now,
        },
        prerequisites: data.prerequisites || { description: 'Audit standard', items: [] },
        steps: data.steps || [],
        parameters: (data as any).parameters || null,
        mediaLibrary: (data as any).mediaLibrary || null,
        postExecution: (data as any).postExecution || null,
      };
      upsertOfflineProcedure(record);
      return { success: true, message: `Actif "${data.title}" forgé localement.`, code, provider: 'LOCAL_REGISTRY', offline: true };
    } catch (e: any) {
      return { success: false, error: 'ERREUR_INTERNE_FORGE', message: e.message };
    }
  },
  '/api/procedures/[id]': async (body: any, webFetch: () => Promise<any>, ctx?: { method?: string; params?: any }) => {
    const method = ctx?.method || 'GET';
    const idOrCode = ctx?.params?.id;
    const { getOfflineProcedure, upsertOfflineProcedure, deleteOfflineProcedure } = await import('./procedures/offline-repo');
    if (method === 'GET') {
      const proc = getOfflineProcedure({ id: idOrCode }) || getOfflineProcedure({ code: idOrCode });
      if (!proc) return { success: false, message: 'Procédure introuvable', status: 404 };
      const meta: any = proc.metadata || {};
      return {
        success: true,
        procedure: {
          id: proc._id,
          code: meta.code,
          title: meta.title,
          category: meta.category,
          criticality: meta.criticality,
          status: 'PUBLISHED',
          metadata: {
            title: meta.title || 'Sans titre',
            code: String(meta.code || '').toUpperCase(),
            category: meta.category || '',
            subcategory: meta.subcategory || '',
            department: meta.department || '',
            criticality: (meta.criticality || 'MEDIUM').toLowerCase(),
            version: meta.version || '1.0.0',
            author: meta.author || { id: 'local', name: 'Local Station', role: 'operator', department: '' },
            approvers: meta.approvers || [],
            tags: meta.tags || [],
            language: meta.language || 'fr',
            createdAt: meta.createdAt || new Date().toISOString(),
            lastUpdated: meta.lastUpdated || new Date().toISOString(),
            description: meta.description || '',
          },
          steps: proc.steps,
          prerequisites: proc.prerequisites,
          parameters: proc.parameters,
          mediaLibrary: proc.mediaLibrary,
          postExecution: proc.postExecution,
        },
        provider: 'LOCAL_REGISTRY',
        offline: true,
      };
    }
    if (method === 'PUT') {
      const existing = getOfflineProcedure({ id: idOrCode }) || getOfflineProcedure({ code: idOrCode });
      if (!existing) return { success: false, error: 'PROCEDURE_NOT_FOUND' };
      const updated = {
        ...existing,
        metadata: {
          ...existing.metadata,
          title: body?.title ?? existing.metadata.title,
          category: body?.category ? body.category.toUpperCase() : existing.metadata.category,
          criticality: body?.criticality ?? existing.metadata.criticality,
          lastUpdated: new Date().toISOString(),
        },
        steps: body?.steps ?? existing.steps,
        prerequisites: body?.prerequisites ?? existing.prerequisites,
        parameters: (body as any)?.parameters ?? existing.parameters,
        mediaLibrary: (body as any)?.mediaLibrary ?? existing.mediaLibrary,
        postExecution: (body as any)?.postExecution ?? existing.postExecution,
      };
      upsertOfflineProcedure(updated);
      return { success: true, procedure: updated, provider: 'LOCAL_REGISTRY', offline: true };
    }
    if (method === 'DELETE') {
      const target = getOfflineProcedure({ id: idOrCode }) || getOfflineProcedure({ code: idOrCode });
      if (!target) return { success: false, error: 'PROCEDURE_NOT_FOUND' };
      deleteOfflineProcedure(target.metadata.code);
      return { success: true, message: 'Procédure supprimée', provider: 'LOCAL_REGISTRY', offline: true };
    }
    return { success: false, error: 'METHODE_NON_SUPPORTER' };
  },
  // ── Procedure Guide (offline) ──────────────────────────────────────────
  // En Desktop offline, l'API Next répond STATIC_EXPORT : on bascule sur le
  // Registre Physique (.registry/procedures/*.json) côté webview. Gère
  // ?list=true (sommaires), ?code=... et ?id=... (détail). Mode web : cette
  // route n'est pas interceptée → fetch cloud normal (guide/route.ts).
  '/api/procedures/guide': async (body: any, webFetch: () => Promise<any>, ctx?: { method?: string; params?: any }) => {
    try {
      const { listOfflineProcedures, getOfflineProcedure } = await import('./procedures/offline-repo');
      // Le contexte porte l'URL résolue (avec query) via ctx.url ; repli sur
      // window.location en Desktop offline.
      const rawUrl: string =
        (ctx as any)?.url ||
        (typeof window !== 'undefined' ? window.location.href : '') ||
        '';
      const qp = new URLSearchParams(rawUrl.includes('?') ? rawUrl.split('?')[1] : '');
      const list = qp.get('list');
      const code = qp.get('code');
      const id = qp.get('id');

      if (list) {
        const procs = listOfflineProcedures().map((p: any) => {
          const meta: any = p.metadata || {};
          const steps = Array.isArray(p.steps) ? p.steps : [];
          return {
            id: p._id,
            code: String(meta.code || '').toUpperCase(),
            title: meta.title || 'Sans titre',
            category: String(meta.category || '—').toUpperCase(),
            criticality: String(meta.criticality || 'normal').toLowerCase(),
            steps: steps.length,
            source: 'file' as const,
          };
        });
        return { success: true, procedures: procs, provider: 'LOCAL_REGISTRY', offline: true };
      }

      const proc =
        (code ? getOfflineProcedure({ code }) : null) ||
        (id ? getOfflineProcedure({ id }) : null);

      if (!proc) return { success: false, message: 'Procédure introuvable', status: 404 };

      const meta: any = proc.metadata || {};
      return {
        success: true,
        procedure: {
          metadata: {
            title: meta.title || 'Sans titre',
            code: String(meta.code || '').toUpperCase(),
            category: String(meta.category || '—').toUpperCase(),
            subcategory: meta.subcategory || '',
            department: meta.department || '',
            criticality: (meta.criticality || 'normal').toLowerCase(),
            version: meta.version || '1.0.0',
            author: meta.author || { id: 'local', name: 'Local Station', role: 'operator', department: '' },
            approvers: meta.approvers || [],
            tags: meta.tags || [],
            language: meta.language || 'fr',
            createdAt: meta.createdAt || new Date().toISOString(),
            lastUpdated: meta.lastUpdated || new Date().toISOString(),
            description: meta.description || '',
          },
          prerequisites: proc.prerequisites || { items: [] },
          steps: proc.steps || [],
          postExecution: proc.postExecution || null,
        },
        provider: 'LOCAL_REGISTRY',
        offline: true,
      };
    } catch (e: any) {
      return { success: false, tree: [], error: 'LECTURE_REGISTRE_ECHEC', message: e.message };
    }
  },
  // ── Local DB mirror (offline) ────────────────────────────────────────────
  // ── Procedure Config Fields (offline) ───────────────────────────────────
  // DÉPLACÉ vers `offlineInterceptors` (voir bas de fichier). Le CRUD des
  // champs de configuration bascule sur le Registre Physique uniquement en
  // mode « Locale uniquement » (localOnly) ou en repli Desktop offline, et
  // rejoint le cloud Prisma en hybride EN LIGNE. Il n'est plus intercepté
  // inconditionnellement ici (ancienne divergence hybride → cloud ignoré).
  // ── Dataset / Q&A (offline) ──────────────────────────────────────────────
  // En Desktop offline, l'API Next répond STATIC_EXPORT : on bascule sur le
  // Registre Physique (.registry/items/*.json) côté webview, calqué sur le
  // pattern des procédures. GET = arbre de l'explorateur ; POST = création/
  // mise à jour d'une collection Q/R. Mode web : ces routes ne sont pas
  // interceptées → fetch cloud normal (Prisma).
  '/api/registry': async (body: any, webFetch: () => Promise<any>, ctx?: { method?: string; params?: any }) => {
    const method = ctx?.method || (body && Object.keys(body).length ? 'POST' : 'GET');
    if (method === 'GET') {
      try {
        const { buildOfflineRegistryTree, readOfflineRegistryFile } = await import('./qr/offline-repo');
        const url: string =
          (ctx as any)?.url ||
          (typeof window !== 'undefined' ? window.location.href : '') ||
          '';
        const qp = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
        const targetPath = qp.get('path');
        if (targetPath) {
          try {
            const content = readOfflineRegistryFile(targetPath);
            return { success: true, content, provider: 'LOCAL_REGISTRY', offline: true };
          } catch (e: any) {
            return { success: false, error: e.message || 'FICHIER_INTROUVABLE' };
          }
        }
        return {
          success: true,
          tree: buildOfflineRegistryTree(),
          provider: 'LOCAL_REGISTRY',
          offline: true,
        };
      } catch (e: any) {
        return { success: false, tree: [], error: 'LECTURE_REGISTRE_ECHEC', message: e.message };
      }
    }
    if (method === 'DELETE') {
      try {
        const { deleteOfflineQA } = await import('./qr/offline-repo');
        const url: string =
          (ctx as any)?.url ||
          (typeof window !== 'undefined' ? window.location.href : '') ||
          '';
        const qp = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
        const targetPath = qp.get('path');
        if (!targetPath) return { success: false, error: 'PATH_REQUIRED' };
        const name = targetPath.split('/').filter(Boolean).pop() || targetPath;
        const ok = deleteOfflineQA(name);
        if (!ok) return { success: false, error: 'ELEMENT_INTROUVABLE' };
        return { success: true, provider: 'LOCAL_REGISTRY', offline: true };
      } catch (e: any) {
        return { success: false, error: 'SUPPRESSION_ECHEC', message: e.message };
      }
    }
    // POST (création / mise à jour)
    try {
      const { upsertOfflineQA, getOfflineQA } = await import('./qr/offline-repo');
      const shallowItemName = (p: string) => (p.split('/').filter(Boolean).pop() || p).replace(/\.json$/i, '');
      const rawPath = body?.path?.toString().trim() || 'items/qr-collection.json';
      const normalizedPath = rawPath.replace(/^\/+|\\/g, '').replace(/\\/g, '/');
      const safeFileName = normalizedPath.split('/').filter(Boolean).pop() || 'qr-collection.json';
      const baseName = safeFileName.replace(/\.json$/i, '');
      const contentText = typeof body.content === 'string' ? body.content : JSON.stringify(body.content || {}, null, 2);
      const parsed = (() => {
        try { return JSON.parse(contentText); } catch { return null; }
      })();

      if (!parsed || parsed.type !== 'qa' || !Array.isArray(parsed.pairs) || parsed.pairs.length === 0) {
        return { success: false, error: 'PAIRS_VIDES', details: 'Une collection Q/R doit contenir au moins une paire.' };
      }
      for (let i = 0; i < parsed.pairs.length; i++) {
        const pair = parsed.pairs[i];
        if (!pair || typeof pair.question !== 'string' || !pair.question.trim()
          || typeof pair.answer !== 'string' || !pair.answer.trim()) {
          return { success: false, error: `PAIR_INVALIDE_${i}`, details: `La paire ${i} nécessite question et answer non vides.` };
        }
      }

      const title = parsed.title || baseName || 'Collection Q/R';
      const registryPath = parsed.registryPath || normalizedPath;
      const existing = getOfflineQA(shallowItemName(registryPath));

      const record: any = {
        ...parsed,
        type: 'qa',
        title,
        registryPath,
        createdAt: existing?.createdAt || new Date().toISOString(),
      };
      upsertOfflineQA(record);
      return {
        success: true,
        itemId: `items/${safeFileName}`,
        updated: !!existing,
        path: registryPath,
        provider: 'LOCAL_REGISTRY',
        offline: true,
      };
    } catch (e: any) {
      return { success: false, error: 'ERREUR_INTERNE_QR', message: e.message };
    }
  },
  // ── Knowledge Base (Q/R sémantique) offline ───────────────────────────────
  // En Desktop offline, l'API Next répond STATIC_EXPORT : on bascule sur le
  // Registre Physique (.registry/items/*.json) côté webview, au même titre que
  // /api/registry. GET = liste des items Q/R ; POST = création/mise à jour.
  // Mode web : cette route n'est pas interceptée → fetch cloud normal (Prisma).
  // Sans cet intercepteur, la création/lecture des Q/R en mode Locale échouait
  // sur un fetch cloud (timeout 15 s) car /api/knowledge n'avait pas de repli
  // offline (cf. analyse de stabilité Knowledge Base).
  '/api/knowledge': async (body: any, webFetch: () => Promise<any>, ctx?: { method?: string; params?: any; url?: string }) => {
    const method = ctx?.method || (body && Object.keys(body).length ? 'POST' : 'GET');

    if (method === 'GET') {
      try {
        const { listOfflineQA } = await import('./qr/offline-repo');
        const items = listOfflineQA().map((rec: any) => ({
          id: `items/${rec.registryPath?.split('/').pop() || `${rec.title}.json`}`,
          type: rec.type || 'qa',
          title: rec.title || '',
          question: rec.pairs?.[0]?.question || null,
          answer: rec.pairs?.map((p: any) => p.answer).filter(Boolean).join('\n\n') || null,
          tags: rec.tags || [],
          category: rec.category || rec.description || 'General',
          content: JSON.stringify(rec),
          createdAt: rec.createdAt || new Date().toISOString(),
          origin: 'LOCAL_REGISTRY',
        }));
        return { success: true, items, provider: 'LOCAL_REGISTRY', offline: true };
      } catch (e: any) {
        return { success: false, items: [], error: 'LECTURE_CONNAISSANCES_ECHEC', message: e.message };
      }
    }

    if (method === 'DELETE') {
      try {
        const { deleteOfflineQA } = await import('./qr/offline-repo');
        const url: string =
          (ctx as any)?.url ||
          (typeof window !== 'undefined' ? window.location.href : '') ||
          '';
        const qp = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
        const targetPath = qp.get('path') || body?.path || '';
        const name = targetPath.split('/').filter(Boolean).pop() || targetPath;
        if (!name) return { success: false, error: 'PATH_REQUIRED' };
        const ok = deleteOfflineQA(name.replace(/\.json$/i, ''));
        if (!ok) return { success: false, error: 'ELEMENT_INTROUVABLE' };
        return { success: true, provider: 'LOCAL_REGISTRY', offline: true };
      } catch (e: any) {
        return { success: false, error: 'SUPPRESSION_ECHEC', message: e.message };
      }
    }

    // POST (création / mise à jour)
    try {
      const { upsertOfflineQA, getOfflineQA } = await import('./qr/offline-repo');
      const { type, title, question, answer, tags, category } = body || {};
      if (!title || !type) {
        return { success: false, error: 'TITRE_ET_TYPE_REQUIS' };
      }
      if (type === 'qa') {
        const q = typeof question === 'string' ? question.trim() : '';
        const a = typeof answer === 'string' ? answer.trim() : '';
        if (!q || !a) {
          return { success: false, error: 'QUESTION_ET_REPONSE_REQUISES' };
        }
      }

      const safeBase = (title.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'qr-collection');
      const registryPath = body?.registryPath || `items/${safeBase}.json`;
      const existing = getOfflineQA(registryPath.split('/').pop() || `${safeBase}.json`);

      const record: any = {
        type: 'qa',
        title: title.trim(),
        description: category || 'General',
        category: category || 'General',
        tags: Array.isArray(tags) ? tags : [],
        pairs: Array.isArray((body as any).pairs)
          ? (body as any).pairs
          : [{ question: question?.trim() || '', answer: answer?.trim() || '' }],
        registryPath,
        createdAt: existing?.createdAt || new Date().toISOString(),
      };
      upsertOfflineQA(record);

      return {
        success: true,
        item: {
          id: registryPath,
          type: 'qa',
          title: record.title,
          question: record.pairs[0]?.question || null,
          answer: record.pairs.map((p: any) => p.answer).filter(Boolean).join('\n\n') || null,
          tags: record.tags,
          category: record.category,
          createdAt: record.createdAt,
          origin: 'LOCAL_REGISTRY',
        },
        updated: !!existing,
        provider: 'LOCAL_REGISTRY',
        offline: true,
      };
    } catch (e: any) {
      return { success: false, error: 'ERREUR_INTERNE_QR', message: e.message };
    }
  },
  // ── Local DB mirror (offline) ────────────────────────────────────────────
  // En Desktop offline, /api/local-db court-circuite en STATIC_EXPORT. On
  // bascule sur le FS .local-db pour le miroir (POST inject) et l'arbre
  // (GET). GET ?path= lit un fichier ; GET sans path renvoie l'arbre.
  '/api/local-db': async (body: any, webFetch: () => Promise<any>, ctx?: { method?: string; params?: any }) => {
    const method = ctx?.method || (body && Object.keys(body).length ? 'POST' : 'GET');
    if (method === 'GET') {
      try {
        const { localDB } = await import('@/lib/db/local-db');
        const url: string =
          (ctx as any)?.url ||
          (typeof window !== 'undefined' ? window.location.href : '') ||
          '';
        const qp = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
        const filePath = qp.get('path');
        if (filePath) {
          const content = await localDB.getFile(filePath);
          return { success: true, content, provider: 'LOCAL_DB', offline: true };
        }
        const tree = await localDB.getTree();
        return { success: true, tree, provider: 'LOCAL_DB', offline: true };
      } catch (e: any) {
        return { success: false, tree: [], error: 'LECTURE_LOCAL_DB_ECHEC', message: e.message };
      }
    }
    // POST (inject / write / index)
    try {
      const { localDB } = await import('@/lib/db/local-db');
      const { fileName, content, metadata, targetDir, type, path: targetPath, action } = body || {};

      if (action === 'index' && targetPath) {
        try {
          const { indexLocalDBFile } = await import('@/lib/local-indexer');
          return await indexLocalDBFile(targetPath.replace(/^\/+/, ''));
        } catch (e: any) {
          return { success: true, indexed: false, message: `Indexation différée: ${e.message}`, provider: 'LOCAL_DB', offline: true };
        }
      }
      if (action === 'index-folder' && targetPath) {
        try {
          const { indexLocalDBFolder } = await import('@/lib/local-indexer');
          return await indexLocalDBFolder(targetPath.replace(/^\/+/, ''));
        } catch (e: any) {
          return { success: true, indexed: false, message: `Indexation différée: ${e.message}`, provider: 'LOCAL_DB', offline: true };
        }
      }
      if (targetPath && type === 'file' && content !== undefined) {
        await localDB.writeFile(targetPath.replace(/^\/+/, ''), content);
        return { success: true, path: targetPath, provider: 'LOCAL_DB', offline: true };
      }
      if (!fileName || content === undefined) {
        return { success: false, error: 'PARAM_MISSING: fileName et content requis' };
      }
      const result = await localDB.injectFile(fileName, content, metadata, targetDir);
      return result;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
  // ── Bank (offline) ───────────────────────────────────────────────────────
  // En Desktop offline, /api/bank court-circuite en STATIC_EXPORT. On bascule
  // sur le FS local : miroir .local-db/bank + Registre physique .registry/bank
  // (pour concordance avec la BDD Web) + indexation Chroma live. GET = liste ;
  // POST = capture/sauvegarde ; DELETE = suppression. Mode web : non
  // intercepté → fetch cloud normal.
  '/api/bank': async (body: any, webFetch: () => Promise<any>, ctx?: { method?: string; params?: any; url?: string }) => {
    const method = ctx?.method || (body && Object.keys(body).length ? 'POST' : 'GET');
    const { localDB } = await import('@/lib/db/local-db');
    const REGISTRY_BANK = path.join(
      process.env.REGISTRY_ROOT_OVERRIDE?.trim() || path.join(process.cwd(), '.registry'),
      'bank'
    );

    if (method === 'GET') {
      try {
        const fs = await import('fs');
        const items: any[] = [];
        if (fs.existsSync(REGISTRY_BANK)) {
          for (const entry of fs.readdirSync(REGISTRY_BANK, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const metaPath = path.join(REGISTRY_BANK, entry.name, 'metadata.json');
            if (!fs.existsSync(metaPath)) continue;
            try { items.push(JSON.parse(fs.readFileSync(metaPath, 'utf8'))); } catch { /* ignore */ }
          }
        }
        return { success: true, items, total: items.length, provider: 'LOCAL_REGISTRY', offline: true };
      } catch (e: any) {
        return { success: false, items: [], error: 'LECTURE_BANQUE_ECHEC', message: e.message };
      }
    }

    if (method === 'DELETE') {
      try {
        const url: string =
          (ctx as any)?.url ||
          (typeof window !== 'undefined' ? window.location.href : '') ||
          '';
        const qp = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
        let rawName = (body?.name as string) || qp.get('name') || '';
        const safeName = rawName.trim().toLowerCase().replace(/[^a-zA-Z0-9-]/g, '_');
        if (!safeName) return { success: false, error: 'NOM_REQUIS' };

        const relFolder = `bank/${safeName}`;
        await localDB.deleteItem(relFolder);
        try {
          const fs = await import('fs');
          const full = path.join(REGISTRY_BANK, safeName);
          if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true });
        } catch { /* ignore */ }
        try {
          const { deleteChromaItem } = await import('@/lib/local-indexer');
          await deleteChromaItem(`${safeName}/metadata.json`);
          await deleteChromaItem(`INDEX_CHROMA/bank/${safeName}/metadata.json`);
        } catch { /* ignore */ }

        return { success: true, message: 'ACTIF_SUPPRIME', provider: 'LOCAL_REGISTRY', offline: true };
      } catch (e: any) {
        return { success: false, error: 'SUPPRESSION_BANQUE_ECHEC', message: e.message };
      }
    }

    // POST (création / capture)
    try {
      const { name, type, data, metadata } = body || {};
      if (!name || !data) return { success: false, error: 'DONNEES_MANQUANTES' };
      if (type !== 'image' && type !== 'video') return { success: false, error: 'TYPE_INVALIDE' };

      const match = /^data:([^;]+);base64,(.+)$/.exec(data);
      if (!match) return { success: false, error: 'FORMAT_ATTENDU_DATA_URI' };
      const mime = match[1].toLowerCase();
      const base64 = match[2];

      const MIME_EXT: Record<string, string> = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
        'image/webp': 'webp', 'image/bmp': 'bmp',
        'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
      };
      const extension = MIME_EXT[mime];
      if (!extension) return { success: false, error: 'MIME_NON_SUPPORTE', mime };
      if (type === 'image' && !mime.startsWith('image/')) return { success: false, error: 'TYPE_INCOHÉRENT_IMAGE' };
      if (type === 'video' && !mime.startsWith('video/')) return { success: false, error: 'TYPE_INCOHÉRENT_VIDEO' };

      const safeName = name.trim().toLowerCase().replace(/[^a-zA-Z0-9-]/g, '_');
      if (!safeName) return { success: false, error: 'NOM_INVALIDE' };

      const assetRel = `${safeName}/${safeName}.${extension}`;
      const metaRel = `${safeName}/metadata.json`;
      const assetPath = `bank/${assetRel}`;
      const metaPath = `bank/${metaRel}`;

      const fs = await import('fs');
      const regAssetFull = path.join(REGISTRY_BANK, assetRel);
      const regMetaFull = path.join(REGISTRY_BANK, metaRel);
      const dir = path.dirname(regAssetFull);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(regAssetFull)) return { success: false, error: 'ACTIF_EXISTANT', path: assetPath };

      const finalMetadata = {
        ...(metadata || {}),
        name: safeName, type, mime,
        path: assetPath,
        size: Buffer.byteLength(base64, 'base64'),
        author: 'local',
        created_at: new Date().toISOString(),
      };

      fs.writeFileSync(regAssetFull, Buffer.from(base64, 'base64'));
      fs.writeFileSync(regMetaFull, JSON.stringify(finalMetadata, null, 2));

      // Miroir .local-db + indexation Chroma (recherche RAG offline).
      try {
        await localDB.saveBankAsset(assetRel, data);
        await localDB.saveBankAsset(metaRel, JSON.stringify(finalMetadata, null, 2));
      } catch (e: any) {
        console.warn('[BANK_OFFLINE] Miroir local ignoré :', e?.message);
      }
      try {
        const { indexLocalDBFile } = await import('@/lib/local-indexer');
        await indexLocalDBFile(`bank/${metaRel}`);
      } catch (e: any) {
        console.warn('[BANK_OFFLINE] Indexation ignorée :', e?.message);
      }

      return { success: true, path: `bank/${safeName}`, provider: 'LOCAL_REGISTRY', offline: true };
    } catch (e: any) {
      return { success: false, error: 'BANK_SAVE_FAILED', message: e.message };
    }
  },
  // ── Vecteurs ChromaDB (offline) ──────────────────────────────────────────
  // En Desktop offline, l'API Next répond STATIC_EXPORT. On bascule sur le
  // moteur vectoriel EMBARQUÉ (JS) pour lister les collections et reconstruire
  // l'arborescence miroir (identique à ce que fait /api/vector/collections en
  // local). Sans cet intercepteur, l'onglet ChromaDB subissait un timeout 15 s
  // (fetch cloud) puis un arbre vide. Mode web : non intercepté (pas de moteur
  // local) → le fetch cloud normal gère l'erreur.
  '/api/vector/collections': async (body: any, webFetch: () => Promise<any>, ctx?: { method?: string; params?: any; url?: string }) => {
    const method = (ctx?.method || 'GET').toUpperCase();
    if (method !== 'GET') {
      // Repli sur le fetch cloud pour POST/DELETE (création/suppression de
      // collection) : ces opérations restent rares en offline et le cloud
      // reste l'autorité.
      try {
        return await webFetch();
      } catch (e: any) {
        return { success: false, error: e?.message || 'VECTOR_OFFLINE_UNSUPPORTED', collections: [] };
      }
    }
    try {
      const { listCollections } = await import('./chroma');
      const { getLocalDBChromaTree } = await import('./local-indexer');
      let collections: any[] = [];
      try {
        collections = (await listCollections()).map((c: any) => ({ ...c, count: 0 }));
      } catch (e: any) {
        console.warn('[HYBRID_BRIDGE] ChromaDB collections indisponible (offline) :', e?.message);
        collections = [];
      }
      const mirrorTree = await getLocalDBChromaTree().catch(() => []);
      return {
        success: true,
        count: collections.length,
        collections,
        mirrorTree,
        provider: 'CHROMA_PERSISTENT_LOCAL',
        offline: true,
      };
    } catch (e: any) {
      return { success: false, error: 'VECTOR_OFFLINE_FAILED', details: e.message, collections: [], mirrorTree: [] };
    }
  },
  '/api/auth/me': async (body: any, webFetch: () => Promise<any>, ctx?: { method?: string; params?: any }) => {
    const method = (ctx?.method || 'GET').toUpperCase();
    const localOnly = typeof localStorage !== 'undefined' && localStorage.getItem('visionode-mode-local-only') === '1';

    if (method === 'GET') {
      const stored = localAuth.getCurrentSession();
      const localUser = stored ? await validateLocalSession(stored) : null;

      if (localOnly) {
        if (!localUser) return { session: null, user: null, offline: true };
        return { session: null, user: localUser, offline: true };
      }

      try {
        const cloudResult = await withTimeout(webFetch());
        if (cloudResult && typeof cloudResult === 'object' && cloudResult.success === false) {
          if (localUser) return { session: null, user: localUser, offline: true };
          return cloudResult;
        }
        return cloudResult;
      } catch (e: any) {
        if (localUser) return { session: null, user: localUser, offline: true };
        return { session: null, user: null, offline: true, error: 'RÉSEAU_INDISPONIBLE' };
      }
    }

    if (method === 'PATCH') {
      if (localOnly) {
        const stored = localAuth.getCurrentSession();
        if (!stored) return { success: false, error: 'UNAUTHENTICATED' };

        const { firstName, lastName, email, newPassword } = body || {};

        if (newPassword && !body?.currentPassword) {
          return { success: false, error: 'INVALID_CURRENT_PASSWORD' };
        }

        const updated = await updateLocalUserProfile(stored.id, {
          firstName,
          lastName,
          email,
          newPassword,
        });

        if (!updated) {
          return { success: false, error: 'UPDATE_FAILED' };
        }

        return { success: true, user: updated, offline: true };
      }

      try {
        const cloudResult = await withTimeout(webFetch());
        if (cloudResult && typeof cloudResult === 'object' && cloudResult.success === false) {
          return cloudResult;
        }
        return cloudResult;
      } catch (e: any) {
        const stored = localAuth.getCurrentSession();
        if (!stored) return { success: false, error: 'UNAUTHENTICATED', errorType: 'NETWORK_DOWN' };

        const { firstName, lastName, email } = body || {};
        const updated = await updateLocalUserProfile(stored.id, { firstName, lastName, email });

        if (!updated) {
          return { success: false, error: 'UPDATE_FAILED', errorType: 'NETWORK_DOWN' };
        }

        return { success: true, user: updated, offline: true, message: 'Profil mis à jour localement (cloud indisponible).' };
      }
    }

    return { success: false, error: 'METHODE_NON_SUPPORTER' };
  },
  '/api/auth/signin': async (body: any, webFetch: () => Promise<any>) => {
    const email = body?.email;
    if (!email) {
      return { success: false, error: 'EMAIL_REQUIS', errorType: 'USER_NOT_FOUND' };
    }

    // Résolution du flag localOnly SANS race condition :
    // 1. priorité absolue au flag explicite transmis par le frontend (source de vérité),
    //    car localStorage peut ne pas être encore persisté au moment de l'appel ;
    // 2. repli sur localStorage uniquement si le frontend n'a pas transmis de valeur
    //    (cas hérité). On normalise en booléen pour ne plus jamais relire localStorage
    //    pendant le traitement.
    let localOnly = body?.localOnly;
    if (typeof localOnly !== 'boolean') {
      localOnly = typeof localStorage !== 'undefined' && localStorage.getItem('visionode-mode-local-only') === '1';
      body.localOnly = localOnly;
    }

    const local = await localSignIn(email, body?.password);
    if (local.success && local.user) {
      console.log('🔐 [HYBRID_BRIDGE] Auth locale (offline) réussie');
      try {
        await upsertLocalUser({
          id: local.user.id,
          email: local.user.email,
          firstName: local.user.firstName,
          lastName: local.user.lastName,
          role: local.user.role,
          approved: local.user.approved,
        });
      } catch (e) {
        console.warn('[HYBRID_BRIDGE] upsertLocalUser échoué (non bloquant):', e);
      }
      return { success: true, user: local.user, provider: 'LOCAL_SQLITE' };
    }

    // Rate-limit local atteint : on renvoie l'erreur typée (sans repli cloud).
    if (!local.success && local.errorType === 'RATE_LIMITED') {
      return {
        success: false,
        error: 'Trop de tentatives. Patientez avant de réessayer.',
        errorType: 'RATE_LIMITED',
        retryAfter: local.retryAfter,
      };
    }
    if (!local.success && local.errorType === 'DB_CORRUPTED') {
      return { success: false, error: 'Base de données locale corrompue. Redémarrez l\'application.', errorType: 'DB_CORRUPTED' };
    }

    // Mode Locale uniquement : aucun repli cloud, on rejette immédiatement.
    if (localOnly) {
      console.log('🚫 [HYBRID_BRIDGE] Auth locale échouée + MODE_LOCALE_ACTIF → pas de repli cloud');
      return { success: false, error: 'MODE_LOCALE_ACTIF', errorType: 'LOCAL_ONLY' };
    }

    console.log('🌐 [HYBRID_BRIDGE] Auth locale échouée → repli cloud');
    try {
      const cloudResult = await withTimeout(webFetch());
      if (cloudResult && typeof cloudResult === 'object' && cloudResult.success === false) {
        return cloudResult;
      }
      return cloudResult;
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ECONNREFUSED') || msg.includes('TIMEOUT')) {
        return { success: false, error: 'RÉSEAU_INDISPONIBLE', errorType: 'NETWORK_DOWN' };
      }
      return { success: false, error: msg || 'ERREUR_CLOUD', errorType: 'UNKNOWN' };
    }
  }
};

/**
 * Extrait le chemin (pathname) depuis une URL complète ou relative.
 * Permet de matcher les intercepteurs que l'URL soit /api/... (web)
 * ou https://cloud/api/... (desktop).
 */
function toPathname(input: string): string {
  try {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      return new URL(input).pathname;
    }
  } catch {
    // ignore
  }
  return input.split('?')[0];
}

/**
 * Résout le flag localOnly SANS race condition (cf. /api/auth/signin) :
 *  - priorité au flag explicite transmis par le frontend (source de vérité) ;
 *  - repli sur le flag localStorage « visionode-mode-local-only ».
 * Normalisé en booléen pour ne plus relire localStorage par la suite.
 */
function resolveLocalOnly(body: any): boolean {
  if (body && typeof body.localOnly === 'boolean') return body.localOnly;
  if (typeof localStorage !== 'undefined' && localStorage.getItem('visionode-mode-local-only') === '1') {
    if (body) body.localOnly = true;
    return true;
  }
  return false;
}

/**
 * Intercepteurs OFFLINE : déclenchés dès que l'app est en mode « Locale
 * uniquement » (localOnly), quel que soit le mode (Web local / Hybride
 * offline / Desktop offline). Ils court-circuitent l'API cloud et
 * répondent depuis le Registre Physique / le moteur local. Ils NE doivent
 * PAS s'exécuter en mode hybride EN LIGNE, où l'on doit rejoindre le cloud.
 */
const offlineInterceptors: Record<string, (body: any, webFetch: () => Promise<any>, ctx?: { method?: string; params?: any }) => Promise<any>> = {
  '/api/procedure-config-fields': async (body: any, _webFetch: () => Promise<any>, ctx?: { method?: string; params?: any }) => {
    const method = ctx?.method || (body && Object.keys(body).length ? 'POST' : 'GET');
    const ALLOWED_TYPES = ['text', 'number', 'boolean', 'select'];
    if (method === 'GET') {
      try {
        const { listOfflineTemplates, ensureDefaultTemplates } = await import('./procedures/offline-repo');
        ensureDefaultTemplates();
        const items = listOfflineTemplates();
        return { success: true, items, provider: 'LOCAL_REGISTRY', offline: true };
      } catch (e: any) {
        return { success: false, items: [], error: 'LECTURE_TEMPLATES_ECHEC', message: e.message };
      }
    }
    if (method === 'POST') {
      try {
        const { name, type, description, options, required } = body || {};
        if (!name || !type) return { success: false, error: 'Name and type are required' };
        if (!ALLOWED_TYPES.includes(type)) {
          return { success: false, error: `Type invalide. Attendu: ${ALLOWED_TYPES.join(', ')}` };
        }
        if (type === 'select' && options !== undefined && !Array.isArray(options)) {
          return { success: false, error: 'Le champ options doit être un tableau pour le type select' };
        }
        const { upsertOfflineTemplate, normalizeTemplateOptions } = await import('./procedures/offline-repo');
        const now = new Date().toISOString();
        const record: any = {
          id: `TPL-${Date.now().toString(36)}`,
          name,
          type,
          description: description ?? null,
          options: normalizeTemplateOptions(options),
          required: Boolean(required) || false,
          createdAt: now,
          updatedAt: now,
        };
        upsertOfflineTemplate(record);
        return { ...record, provider: 'LOCAL_REGISTRY', offline: true };
      } catch (e: any) {
        return { success: false, error: 'ERREUR_INTERNE_TEMPLATE', message: e.message };
      }
    }
    return { success: false, error: 'METHODE_NON_SUPPORTER' };
  },
  '/api/procedure-config-fields/[id]': async (body: any, _webFetch: () => Promise<any>, ctx?: { method?: string; params?: any }) => {
    const method = ctx?.method || 'GET';
    const id = ctx?.params?.id;
      const { getOfflineTemplate, upsertOfflineTemplate, deleteOfflineTemplate, normalizeTemplateOptions } = await import('./procedures/offline-repo');
      if (method === 'GET') {
        const tpl = getOfflineTemplate(id);
        if (!tpl) return { success: false, message: 'Template introuvable', status: 404 };
        return { ...tpl, provider: 'LOCAL_REGISTRY', offline: true };
      }
      if (method === 'PATCH') {
        const existing = getOfflineTemplate(id);
        if (!existing) return { success: false, error: 'TEMPLATE_NOT_FOUND' };
        const ALLOWED_TYPES = ['text', 'number', 'boolean', 'select'];
        const { name, type, description, options, required } = body || {};
        if (type !== undefined && !ALLOWED_TYPES.includes(type)) {
          return { success: false, error: `Type invalide. Attendu: ${ALLOWED_TYPES.join(', ')}` };
        }
        const updated: any = {
          ...existing,
          name: name !== undefined ? name : existing.name,
          type: type !== undefined ? type : existing.type,
          description: description !== undefined ? description ?? null : existing.description,
          options: options !== undefined ? normalizeTemplateOptions(options) : existing.options,
          required: required !== undefined ? Boolean(required) : existing.required,
          updatedAt: new Date().toISOString(),
        };
      upsertOfflineTemplate(updated);
      return { ...updated, provider: 'LOCAL_REGISTRY', offline: true };
    }
    if (method === 'DELETE') {
      const ok = deleteOfflineTemplate(id);
      if (!ok) return { success: false, error: 'TEMPLATE_NOT_FOUND' };
      return { success: true, provider: 'LOCAL_REGISTRY', offline: true };
    }
    return { success: false, error: 'METHODE_NON_SUPPORTER' };
  },
};

export async function executeHybridRequest<TReq, TRes>(
  path: string,
  body: TReq,
  webFetch: () => Promise<TRes>,
  ctx?: { method?: string; params?: any; url?: string }
): Promise<TRes> {
  const cleanPath = toPathname(path);

  // 1. Mode « Locale uniquement » (localOnly) : on court-circuite TOUJOURS
  //    le cloud (Web local, Hybride offline, Desktop offline) via le registre
  //    physique / moteur local. C'est le contrat du mode local.
  const localOnly = resolveLocalOnly(body);
  if (localOnly && offlineInterceptors[cleanPath]) {
    console.log(`🔌 [HYBRID_BRIDGE] Interception OFFLINE (localOnly) : ${cleanPath}`);
    return (await offlineInterceptors[cleanPath](body, webFetch, ctx)) as TRes;
  }

  // 2. Pont hybride Desktop (vector/vision/auth) : moteurs locaux embarqués,
  //    actifs uniquement sous Tauri, avec repli cloud si non localOnly.
  if (isDesktop && desktopInterceptors[cleanPath]) {
    console.log(`🔌 [HYBRID_BRIDGE] Interception EXE : ${cleanPath}`);
    return (await desktopInterceptors[cleanPath](body, webFetch, ctx)) as TRes;
  }

  // 3. Sinon : fetch réel vers le cloud. En Desktop (hybride OU offline), si
  //    l'appel cloud échoue (réseau coupé / STATIC_EXPORT), on repli
  //    silencieusement sur le registre offline pour les routes concernées —
  //    cohérent avec le comportement des procédures/registry en Desktop.
  if (isDesktop && offlineInterceptors[cleanPath]) {
    try {
      return await webFetch();
    } catch (e: any) {
      console.warn(`[HYBRID_BRIDGE] Cloud indisponible → repli offline : ${cleanPath}`);
      return (await offlineInterceptors[cleanPath](body, webFetch, ctx)) as TRes;
    }
  }

  console.log(`🌐 [HYBRID_BRIDGE] Fetch réel : ${cleanPath}`);
  return await webFetch();
}
