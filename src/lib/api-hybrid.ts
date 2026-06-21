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

// Interceptor registry for desktop mode with pre-registered fallback handlers
const desktopInterceptors: Record<string, (body: any) => any> = {
  '/api/chat': async (body: any) => {
    return {
      response: `🤖 [VisioNode Offline] Mode bureau/local actif. Message traité : "${body.message}"`,
      history: body.history || [],
      offline: true,
      provider: 'local-mock'
    };
  },
  '/api/github': async (body: any) => {
    return {
      success: true,
      message: `Mode bureau/local actif. Opération de synchronisation "${body.mode}" simulée avec succès.`,
      logs: 'SUCCÈS : Mode local exécuté avec succès.',
      offline: true
    };
  },
  '/api/vision/description': async (body: any) => {
    const { photoDataUri } = body;
    try {
      const { visionAssistantDescription } = await import('@/ai/flows/vision-assistant-description');
      return await visionAssistantDescription({ photoDataUri });
    } catch (e: any) {
      return {
        description: "Analyse visuelle de secours. Statut : Composant détecté.",
        categories: ["Industrie"],
        objects: ["Équipement"],
        offline: true,
        provider: 'local-fallback'
      };
    }
  },
  '/api/vision/retrieval': async (body: any) => {
    const { imageDataUri } = body;
    try {
      const { visualDocumentRetrieval } = await import('@/ai/flows/visual-document-retrieval');
      return await visualDocumentRetrieval({ imageDataUri });
    } catch (e: any) {
      return {
        componentDescription: "COMPOSANT INDUSTRIEL",
        relevantDocuments: [],
        offline: true,
        provider: 'local-fallback'
      };
    }
  },
  '/api/sync/upload': async (body: any) => {
    return { success: true, message: 'Sync upload simulated offline' };
  },
  '/api/sync/download': async (body: any) => {
    return { items: [], message: 'Sync download simulated offline' };
  },
  '/api/vector/collections': async (body: any) => {
    return { success: true, count: 0, collections: [] };
  },
  '/api/vector/search': async (body: any) => {
    return { success: true, query: body.query || '', collection: body.collection || '', count: 0, results: [] };
  },
  '/api/vector/demo': async () => {
    return { success: true, demo: 'simulated' };
  },
  '/api/vector/documents': async (body: any) => {
    return { success: true, message: `${body.documents?.length || 0} document(s) simulés en local.` };
  },
  '/api/vector/ingest': async (body: any) => {
    const { filename, items, metadata } = body;
    if (typeof window !== 'undefined') {
      const storageKey = `visionode_local_dataset_${filename}`;
      localStorage.setItem(storageKey, JSON.stringify(body));
    }
    
    if (typeof window === 'undefined') {
      try {
        const { upsertDocuments } = await import('@/lib/chroma');
        const collectionName = String(metadata.collection || 'industrial_manuals');
        const docs = items.map((item: any, index: number) => ({
          id: `${filename.replace(/\.[^/.]+$/, "")}-${index}`,
          content: `Question: ${item.question}\nRéponse: ${item.answer}`,
          metadata: {
            source: filename,
            index,
            ...metadata
          }
        }));
        await upsertDocuments(collectionName, docs);
      } catch (e: any) {
        console.warn('⚠️ Vectorisation non disponible.', e.message);
      }
    }
    
    return {
      success: true,
      message: `${items?.length || 0} questions/réponses sauvegardées en local (Tauri).`,
      filename,
      count: items?.length || 0,
      offline: true
    };
  }
};

/**
 * Registers a client-side/webview handler for a specific route path, used under Tauri Desktop.
 */
export function registerDesktopInterceptor<TReq, TRes>(
  path: string,
  handler: (body: TReq) => Promise<TRes> | TRes
) {
  desktopInterceptors[path] = handler;
}

/**
 * Resolves the route dynamically on Web, or intercepts and executes the offline/mock handler on Desktop.
 */
export async function executeHybridRequest<TReq, TRes>(
  path: string,
  body: TReq,
  webFetch: () => Promise<TRes>
): Promise<TRes> {
  if (isDesktop) {
    const localHandler = desktopInterceptors[path];
    if (localHandler) {
      console.log(`🔌 [API_HYBRID] [DESKTOP] Interception locale pour la route : ${path}`);
      try {
        return await localHandler(body);
      } catch (error: any) {
        console.error(`❌ [API_HYBRID] [DESKTOP] Échec du handler local pour ${path}:`, error.message);
        throw error;
      }
    }
    console.warn(`⚠️ [API_HYBRID] [DESKTOP] Aucun handler local trouvé pour ${path}. Tentative d'appel réseau...`);
  }
  return await webFetch();
}

/**
 * Next.js API Route builder helper.
 * Prevents compilation/runtime crashes in static export environments by providing simple fallback behavior.
 */
export function createHybridRoute<TReq, TRes>(definition: HybridRouteDefinition<TReq, TRes>) {
  return async (req: Request) => {
    const timestamp = new Date().toLocaleTimeString();
    const isDesktopBuild = process.env.TAURI_ENV === 'true';

    if (isDesktopBuild) {
      // During Tauri build, we output fallback static response to avoid compilation errors
      try {
        const body = req.body ? await req.json().catch(() => ({} as TReq)) : ({} as TReq);
        const res = await definition.desktopFallback(body);
        return NextResponse.json(res);
      } catch (e: any) {
        return NextResponse.json({ error: 'STATIC_EXPORT_FALLBACK', details: e.message });
      }
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
      console.error(`❌ [${timestamp}] [HYBRID_ROUTE] [${definition.name}] Échec :`, error.message);
      return NextResponse.json({
        error: 'ERREUR_ROUTE_HYBRIDE',
        details: error.message
      }, { status: 500 });
    }
  };
}
