
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionFromToken } from '@/lib/session';

/**
 * Middleware de surveillance et protection [AUTH_MIDDLEWARE].
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Ignorer les fichiers statiques et les APIs publiques
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/installers') || 
    pathname.includes('.') ||
    pathname.startsWith('/api/auth/register') ||
    pathname.startsWith('/api/auth/signin')
  ) {
    return NextResponse.next();
  }

  try {
    const token = request.cookies.get('visionode-session')?.value;
    let session = null;
    
    if (token) {
      session = await getSessionFromToken(token).catch(() => null);
    }

    const user = session?.user;
    const isAuthPage = pathname.startsWith('/auth');

    // 1. Protection des accès non-authentifiés
    if (!user && !isAuthPage) {
      console.log(`[AUTH_MIDDLEWARE] [STEP] Accès refusé à ${pathname}. Redirection /auth/signin.`);
      const signInUrl = new URL('/auth/signin', request.url);
      return NextResponse.redirect(signInUrl);
    }

    // 2. Gestion des accès déjà authentifiés vers les pages d'auth
    if (user && isAuthPage) {
      console.log(`[AUTH_MIDDLEWARE] [STEP] Utilisateur déjà authentifié (${user.id}). Skip /auth.`);
      const dashboardUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashboardUrl);
    }

    // 3. Protection du périmètre Admin
    if (pathname.startsWith('/admin') && user?.role !== 'admin') {
      console.warn(`[AUTH_MIDDLEWARE] [REJECT] Accès Admin interdit pour : ${user?.id} (${user?.role})`);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // 4. Validation réussie
    if (user) {
      console.log(`[AUTH_MIDDLEWARE] [SUCCESS] Requête autorisée pour ${user.id} -> ${pathname}`);
    }

    return NextResponse.next();
  } catch (error: any) {
    console.error('[AUTH_MIDDLEWARE] [ERROR] Panique middleware :', error.message);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
