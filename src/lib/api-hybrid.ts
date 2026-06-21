
import { NextResponse } from 'next/server';
import { isDesktop } from './platform';

/**
 * Type structure representing the API Route context.
 */
export interface HybridRouteDefinition<TReq, TRes> {
  name: string;
  webHandler: (req: Request, body: TReq) => Promise<Response | TRes>;
  desktopFallback: (body: TReq) => Promise<TRes> | TRes;
}

// Interceptor registry for desktop mode with lightweight mock handlers
// These are used when the app runs as an EXE and cannot reach a real API Route
const desktopInterceptors: Record<string, (body: any) => any> = {
  '/api/chat': async (body: any) => {
    return {
      text: `🤖 [VisioNode Offline] Mode bureau actif. Message : "${body.message}"`,
      provider: 'local-mock'
    };
  },
  '/api/github': async (body: any) => {
    return {
      success: true,
      message: `Mode bureau actif. Opération "${body.mode}" simulée.`,
      logs: 'SUCCÈS : Simulation locale terminée.',
      offline: true
    };
  },
  '/api/vision/description': async () => {
    return {
      description: "Analyse visuelle simulée (Mode Bureau).",
      categories: ["Industrie", "Offline"],
      objects: ["Composant détecté"],
      offline: true,
      provider: 'local-mock'
    };
  },
  '/api/vision/retrieval': async () => {
    return {
      componentDescription: "COMPOSANT INDUSTRIEL",
      relevantDocuments: [],
      offline: true,
      provider: 'local-mock'
    };
  },
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

/**
 * Next.js API Route builder helper.
 * Strictly used on Server-side (Vercel/Dev).
 */
export function createHybridRoute<TReq, TRes>(definition: HybridRouteDefinition<TReq, TRes>) {
  return async (req: Request) => {
    const isDesktopBuild = process.env.TAURI_ENV === 'true';

    if (isDesktopBuild) {
      // During static export, provide a fallback JSON
      return NextResponse.json({ error: 'STATIC_EXPORT' });
    }

    try {
      let body: TReq = {} as TReq;
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        body = await req.json().catch(() => ({} as TReq));
      }
      
      const response = await definition.webHandler(req, body);
      if (response instanceof Response) {
        return response;
      }
      return NextResponse.json(response);
    } catch (error: any) {
      console.error(`❌ [HYBRID_ROUTE] [${definition.name}] Échec :`, error.message);
      return NextResponse.json({
        error: 'ERREUR_ROUTE_HYBRIDE',
        details: error.message
      }, { status: 500 });
    }
  };
}
