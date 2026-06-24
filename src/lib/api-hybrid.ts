import { isDesktop } from './platform';

/**
 * Registre des intercepteurs Desktop (Mocks légers pour la version EXE).
 * Garantit que l'app ne crashe pas sans backend Node.js.
 */
const desktopInterceptors: Record<string, (body: any) => any> = {
  '/api/chat': async (body: any) => ({
    text: `🤖 [Mode Natif] Simulation de réponse IA pour : "${body.message}"`,
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
    message: `${body.items?.length || 0} éléments sauvegardés dans le cache local.`,
    provider: 'LOCAL_STORAGE'
  }),
  '/api/vision/description': async () => ({
    description: "Analyse visuelle simulée (EXE).",
    categories: ["Industrie", "Offline"],
    objects: ["Capteur", "Panneau"],
    provider: 'LOCAL_VISION'
  })
};

/**
 * Routeur hybride : Exécute le fetch réel sur Web/Vercel, 
 * et intercepte via les mocks sur Desktop (EXE).
 */
export async function executeHybridRequest<TReq, TRes>(
  path: string,
  body: TReq,
  webFetch: () => Promise<TRes>
): Promise<TRes> {
  if (isDesktop) {
    // Nettoyage du chemin pour ignorer les paramètres de requête lors de la correspondance
    const cleanPath = path.split('?')[0];
    const localHandler = desktopInterceptors[cleanPath];
    if (localHandler) {
      console.log(`🔌 [HYBRID_BRIDGE] Interception EXE : ${cleanPath}`);
      return await localHandler(body);
    }
  }
  return await webFetch();
}
