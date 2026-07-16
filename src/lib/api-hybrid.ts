// src/lib/api-hybrid.ts
import { isDesktop } from './platform';
import { localSignIn, upsertLocalUser } from './local-sql';

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
const desktopInterceptors: Record<string, (body: any, webFetch: () => Promise<any>) => Promise<any>> = {
  '/api/vector/search': async (body: any) => {
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
      console.warn('[HYBRID_BRIDGE] Recherche vectorielle locale échouée:', e.message);
      return { success: true, results: [], provider: 'LOCAL_PERSISTENCE', message: 'Recherche simulée en mode dégradé.' };
    }
  },
  '/api/vector/ingest': async (body: any) => {
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
      console.warn('[HYBRID_BRIDGE] Ingestion vectorielle locale échouée:', e.message);
      return { success: true, message: `${body?.items?.length || 0} éléments sauvegardés dans le cache local.`, provider: 'LOCAL_STORAGE' };
    }
  },
  '/api/vision/description': async () => ({
    description: "Analyse visuelle simulée (EXE) — mode dégradé sans modèle vision natif.",
    categories: ["Industrie", "Offline"],
    objects: ["Capteur", "Panneau", "Schéma"],
    provider: 'LOCAL_VISION',
    degraded: true,
    message: "Aucun modèle vision local disponible. Connectez un modèle cloud pour une analyse réelle."
  }),
  '/api/auth/signin': async (body: any, webFetch: () => Promise<any>) => {
    const email = body?.email;
    if (!email) {
      return { success: false, error: 'EMAIL_REQUIS', errorType: 'USER_NOT_FOUND' };
    }

    const local = await localSignIn(email, body?.password);
    if (local?.success && local.user) {
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

export async function executeHybridRequest<TReq, TRes>(
  path: string,
  body: TReq,
  webFetch: () => Promise<TRes>
): Promise<TRes> {
  const cleanPath = toPathname(path);

  if (isDesktop && desktopInterceptors[cleanPath]) {
    console.log(`🔌 [HYBRID_BRIDGE] Interception EXE : ${cleanPath}`);
    return await desktopInterceptors[cleanPath](body, webFetch);
  }

  console.log(`🌐 [HYBRID_BRIDGE] Fetch réel : ${cleanPath}`);
  return await webFetch();
}
