// src/lib/api-hybrid.ts
import { isDesktop } from './platform';
import { localSignIn } from './local-sql';

/**
 * Registre des intercepteurs Desktop.
 * - Routes purement locales simulées (vector/vision) : réponse mock.
 * - /api/auth/signin : auth locale offline (SQLite embarquée) d'abord,
 *   repli sur le cloud si l'utilisateur n'est pas en local.
 * Toutes les autres routes passent par le fetch réel vers le cloud.
 */
const desktopInterceptors: Record<string, (body: any, webFetch: () => Promise<any>) => Promise<any>> = {
  '/api/vector/search': async () => ({
    success: true,
    results: [],
    provider: 'LOCAL_PERSISTENCE',
    message: 'Recherche simulée en mode dégradé.'
  }),
  '/api/vector/ingest': async (body: any) => ({
    success: true,
    message: `${body?.items?.length || 0} éléments sauvegardés dans le cache local.`,
    provider: 'LOCAL_STORAGE'
  }),
  '/api/vision/description': async () => ({
    description: "Analyse visuelle simulée (EXE).",
    categories: ["Industrie", "Offline"],
    objects: ["Capteur", "Panneau"],
    provider: 'LOCAL_VISION'
  }),
  '/api/auth/signin': async (body: any, webFetch: () => Promise<any>) => {
    // 1) Auth locale offline (SQLite embarquée, pré-remplie au 1er lancement)
    const local = await localSignIn(body?.email, body?.password);
    if (local) {
      console.log('🔐 [HYBRID_BRIDGE] Auth locale (offline) réussie');
      return local;
    }
    // 2) Repli cloud (compte utilisateur créé en ligne, ou hors baseline)
    console.log('🌐 [HYBRID_BRIDGE] Auth locale échouée → repli cloud');
    return await webFetch();
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
  // NETTOYAGE : ne garder que le pathname (sans domaine ni query)
  const cleanPath = toPathname(path);

  if (isDesktop && desktopInterceptors[cleanPath]) {
    console.log(`🔌 [HYBRID_BRIDGE] Interception EXE : ${cleanPath}`);
    return await desktopInterceptors[cleanPath](body, webFetch);
  }

  // ✅ Fetch réel (cloud pour desktop, relatif pour web)
  console.log(`🌐 [HYBRID_BRIDGE] Fetch réel : ${cleanPath}`);
  return await webFetch();
}
