
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionFromToken } from '@/lib/session';

/**
 * Middleware de surveillance avec logs structurés [AUTH_MIDDLEWARE].
 */
export async function middleware(request: NextRequest) {
  const ts = new Date().toLocaleTimeString();
  const { pathname } = request.nextUrl;
  
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

    if (!user && !isAuthPage) {
      console.log(`🛡️ [AUTH_MIDDLEWARE] [REJECT] [${ts}] Accès refusé à ${pathname}. Redirection.`);
      const signInUrl = new URL('/auth/signin', request.url);
      return NextResponse.redirect(signInUrl);
    }

    if (user && isAuthPage) {
      console.log(`🛡️ [AUTH_MIDDLEWARE] [STEP] [${ts}] Déjà authentifié. Skip /auth.`);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (user) {
      console.log(`🛡️ [AUTH_MIDDLEWARE] [SUCCESS] [${ts}] Requête autorisée : ${user.id} -> ${pathname}`);
    }

    return NextResponse.next();
  } catch (error: any) {
    console.error(`🛡️ [AUTH_MIDDLEWARE] [ERROR] [${ts}] Panique :`, error.message);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
