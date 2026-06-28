import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionFromToken } from '@/lib/session';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('visionode-session')?.value;
  let session = null;
  if (token) {
    session = await getSessionFromToken(token);
  }

  const user = session?.user;
  const { pathname } = request.nextUrl;

  // Permettre l'accès aux pages publiques, API d'authentification et assets statiques
  const isAuthPage = pathname.startsWith('/auth');
  const isApiAuth = pathname.startsWith('/api/auth');
  
  if (!user && !isAuthPage && !isApiAuth) {
    const signInUrl = new URL('/auth/signin', request.url);
    return NextResponse.redirect(signInUrl);
  }

  // Rediriger les utilisateurs déjà connectés loin des pages de connexion
  if (user && isAuthPage) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // Protection de la console admin : réservée aux utilisateurs ayant le rôle admin
  if (pathname.startsWith('/admin') && user?.role !== 'admin') {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/chat/:path*',
    '/dataset/:path*',
    '/bdd/:path*',
    '/bank/:path*',
    '/conference/:path*',
    '/admin/:path*',
    '/auth/:path*',
  ],
};