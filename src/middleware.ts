
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionFromToken } from '@/lib/session';

/**
 * Middleware de surveillance industrielle avec logs structurés [AUTH].
 */
export async function middleware(request: NextRequest) {
  const ts = new Date().toLocaleTimeString();
  const { pathname } = request.nextUrl;
  
  // Chemins exemptés
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
      console.log(`🛡️ [AUTH] [REJECT] [${ts}] Accès refusé à ${pathname}. Redirection vers /signin.`);
      const signInUrl = new URL('/auth/signin', request.url);
      return NextResponse.redirect(signInUrl);
    }

    if (user && isAuthPage) {
      console.log(`🛡️ [AUTH] [STEP] [${ts}] Déjà authentifié. Saut vers dashboard.`);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (user) {
      // Log périodique pour éviter de spammer mais garder une trace
      if (!pathname.startsWith('/api')) {
        console.log(`🛡️ [AUTH] [SUCCESS] [${ts}] Requête autorisée : ${user.id} -> ${pathname}`);
      }
    }

    return NextResponse.next();
  } catch (error: any) {
    console.error(`🛡️ [AUTH] [ERROR] [${ts}] Panique middleware :`, error.message);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
