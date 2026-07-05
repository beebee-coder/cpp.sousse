import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionFromToken } from '@/lib/session';

/**
 * Middleware de Sécurité VisioNode V8.1.0.
 * Basé sur le système JWT souverain (compatible Web & Tauri Deep-Links).
 */
export async function proxy(request: NextRequest) {
  const ts = new Date().toLocaleTimeString();
  const { pathname } = request.nextUrl;

  // 1. Chemins publics (Exemptions)
  const publicPaths = [
    '/_next',
    '/auth',
    '/api/auth',
    '/favicon.ico',
    '/images',
    '/installers',
    '/api/download',
    '/api/local-db',
    '/api/registry'
  ];

  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 2. Récupération de la session souveraine
  const token = request.cookies.get('visionode-session')?.value;
  const session = token ? await getSessionFromToken(token) : null;

  // 3. Redirection si non authentifié
  if (!session) {
    console.warn(`🛡️ [AUTH] [REJECT] [${ts}] Accès refusé à ${pathname}. Redirection vers signin.`);
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // 4. Protection Admin
  if (pathname.startsWith('/admin') && session.user.role !== 'admin') {
    console.warn(`🛡️ [AUTH] [REJECT] [${ts}] Privilèges insuffisants pour ${pathname}.`);
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

