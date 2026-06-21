import { NextResponse } from 'next/server';

/**
 * @fileOverview Utilities for creating hybrid-compatible API Routes.
 * This file is SERVER-ONLY to prevent next/server leaking to client bundles.
 */

export interface HybridRouteDefinition<TReq, TRes> {
  name: string;
  webHandler: (req: Request, body: TReq) => Promise<Response | TRes>;
}

/**
 * Next.js API Route builder helper.
 * Strictly used on Server-side (Vercel/Dev).
 */
export function createHybridRoute<TReq, TRes>(definition: HybridRouteDefinition<TReq, TRes>) {
  return async (req: Request) => {
    // Avoid dynamic execution during static export phase
    const isDesktopBuild = process.env.TAURI_ENV === 'true';
    if (isDesktopBuild) {
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
