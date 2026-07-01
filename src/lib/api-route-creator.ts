import { NextResponse } from 'next/server';

/**
 * @fileOverview Utilitaires pour la création de routes API compatibles avec le mode hybride.
 * Ce fichier est SERVER-ONLY.
 */

export interface HybridRouteDefinition<TReq, TRes> {
  name: string;
  webHandler: (req: Request, body: TReq, params?: any) => Promise<Response | TRes>;
}

/**
 * Helper pour construire des routes API Next.js résilientes.
 */
export function createHybridRoute<TReq, TRes>(definition: HybridRouteDefinition<TReq, TRes>) {
  return async (req: Request, context?: { params: Promise<any> }) => {
    // Éviter l'exécution dynamique pendant la phase d'export statique (Tauri)
    const isDesktopBuild = process.env.TAURI_ENV === 'true';
    if (isDesktopBuild) {
      return NextResponse.json({ error: 'STATIC_EXPORT' });
    }

    try {
      let body: TReq = {} as TReq;
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        body = await req.json().catch(() => ({} as TReq));
      }
      
      // Attendre les paramètres de chemin si présents (Next.js 15)
      const resolvedParams = context?.params ? await context.params : undefined;
      
      const response = await definition.webHandler(req, body, resolvedParams);
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
