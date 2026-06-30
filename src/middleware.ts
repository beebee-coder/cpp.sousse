import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionFromToken } from '@/lib/session';

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

    // Redirection si non authentifié
    if (!user && !isAuthPage) {
      const signInUrl = new URL('/auth/signin', request.url);
      return NextResponse.redirect(signInUrl);
    }

    // Redirection si déjà authentifié (évite la boucle sur signin)
    if (user && isAuthPage) {
      const dashboardUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashboardUrl);
    }

    // Protection Admin
    if (pathname.startsWith('/admin') && user?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
  } catch (error) {
    // En cas d'erreur critique de session, on laisse passer pour éviter de bloquer le serveur
    // La page de destination gérera l'absence de session
    console.error('[MIDDLEWARE_ERROR]', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
