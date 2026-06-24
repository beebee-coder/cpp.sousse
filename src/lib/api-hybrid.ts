// src/lib/api-hybrid.ts
import { isDesktop } from './platform';

/**
 * Registre des intercepteurs Desktop (Mocks légers pour la version EXE).
 * UNIQUEMENT pour les routes qui ne peuvent pas fonctionner en Desktop.
 */
const desktopInterceptors: Record<string, (body: any) => any> = {
  '/api/chat': async (body: any) => ({
    text: `🤖 [Mode Natif] Simulation de réponse IA pour : "${body?.message || 'message vide'}"`,
    provider: 'OFFLINE_STATION'
  }),
  '/api/vector/search': async (body: any) => ({
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
  })
  // ❌ PAS d'intercepteur pour /api/registry
  // ❌ PAS d'intercepteur pour /api/vector/collections
};

/**
 * Routeur hybride : 
 * - Web : exécute le fetch réel
 * - Desktop : exécute le fetch réel (sauf pour les routes interceptées)
 */
export async function executeHybridRequest<TReq, TRes>(
  path: string,
  body: TReq,
  webFetch: () => Promise<TRes>
): Promise<TRes> {
  // NETTOYAGE : Supprimer l'interception desktop pour les routes de registry
  const cleanPath = path.split('?')[0];
  
  // ⚠️ SEULES les routes dans desktopInterceptors sont interceptées
  // /api/registry N'EST PAS dans la liste → fetch réel
  if (isDesktop && desktopInterceptors[cleanPath]) {
    console.log(`🔌 [HYBRID_BRIDGE] Interception EXE : ${cleanPath}`);
    return await desktopInterceptors[cleanPath](body);
  }

  // ✅ TOUTES les autres routes (dont /api/registry) passent par le fetch réel
  console.log(`🌐 [HYBRID_BRIDGE] Fetch réel : ${cleanPath}`);
  return await webFetch();
}