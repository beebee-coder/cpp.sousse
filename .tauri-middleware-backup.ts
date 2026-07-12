// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * @fileOverview Middleware CORS global pour l'API hybride.
 *
 * Le client desktop (Tauri) appelle l'API cloud (Vercel) en cross-origin.
 * Ce middleware ajoute les en-têtes CORS à TOUTES les routes /api/* et gère
 * les requêtes preflight OPTIONS, ainsi AUCUNE route API n'a besoin de le faire
 * individuellement. L'authentification par cookie fonctionne car on echo l'origine
 * et on autorise les credentials.
 */

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');

  // Preflight OPTIONS
  if (request.method === 'OPTIONS') {
    const res = new NextResponse(null, { status: 204 });
    setCors(res, origin);
    return res;
  }

  // Requête normale : on continue et on ajoute les en-têtes CORS à la réponse.
  const res = NextResponse.next();
  setCors(res, origin);
  return res;
}

function setCors(res: NextResponse, origin: string | null) {
  res.headers.set('Access-Control-Allow-Origin', origin || '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.headers.set('Access-Control-Allow-Credentials', 'true');
}

export const config = {
  matcher: ['/api/:path*'],
};
