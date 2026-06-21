import { isDesktop } from './platform';

/**
 * Registry of desktop interceptors (lightweight mocks)
 * used only when the app is running in the native Tauri container.
 */
const desktopInterceptors: Record<string, (body: any) => any> = {
  '/api/chat': async (body: any) => ({
    text: `🤖 [VisioNode Offline] Mode bureau actif. Message : "${body.message}"`,
    provider: 'local-mock'
  }),
  '/api/github': async (body: any) => ({
    success: true,
    message: `Mode bureau actif. Opération "${body.mode}" simulée.`,
    logs: 'SUCCÈS : Simulation locale terminée.',
    offline: true
  }),
  '/api/vision/description': async () => ({
    description: "Analyse visuelle simulée (Mode Bureau).",
    categories: ["Industrie", "Offline"],
    objects: ["Composant détecté"],
    offline: true,
    provider: 'local-mock'
  }),
  '/api/vision/retrieval': async () => ({
    componentDescription: "COMPOSANT INDUSTRIEL",
    relevantDocuments: [],
    offline: true,
    provider: 'local-mock'
  }),
  '/api/sync/upload': async () => ({ success: true, message: 'Upload simulé' }),
  '/api/sync/download': async () => ({ items: [], message: 'Download simulé' }),
  '/api/vector/collections': async () => ({ success: true, count: 0, collections: [] }),
  '/api/vector/search': async (body: any) => ({ success: true, query: body.query || '', results: [] }),
  '/api/vector/ingest': async (body: any) => ({
    success: true,
    message: `${body.items?.length || 0} paires sauvegardées localement.`,
    offline: true
  })
};

/**
 * Resolves the route dynamically on Web, or intercepts and executes the offline mock on Desktop.
 * Safe for client-side usage.
 */
export async function executeHybridRequest<TReq, TRes>(
  path: string,
  body: TReq,
  webFetch: () => Promise<TRes>
): Promise<TRes> {
  if (isDesktop) {
    const localHandler = desktopInterceptors[path];
    if (localHandler) {
      console.log(`🔌 [API_HYBRID] [DESKTOP] Interception locale : ${path}`);
      return await localHandler(body);
    }
  }
  return await webFetch();
}
