export const dynamic = 'force-dynamic';
export const revalidate = false;
import { NextRequest, NextResponse } from 'next/server';
import { createSessionCookie } from '@/lib/session';
import { jwtVerify } from 'jose';
import { authAudit } from '@/lib/auth-audit';

const SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';
const encodedSecret = new TextEncoder().encode(SECRET);

/**
 * POST /api/auth/verify-magic-link
 * Reçoit un JWT via deep link depuis l'application Tauri, le vérifie et crée la session locale.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';

  try {
    const body = await request.json();
    const token = body.token;

    if (!token) {
      authAudit.warn('MAGIC_LINK_VERIFY_MISSING_TOKEN', { ip });
      return NextResponse.json({ success: false, message: 'Token manquant' }, { status: 400 });
    }

    // Vérifier le JWT (émission web + audience desktop uniquement)
    const { payload } = await jwtVerify(token, encodedSecret, {
      algorithms: ['HS256'],
      issuer: 'visionode-web',
      audience: 'visionode-desktop',
    });

    const user = (payload as any).user;

    if (!user || !user.id) {
      authAudit.warn('MAGIC_LINK_VERIFY_INVALID_PAYLOAD', { ip });
      return NextResponse.json({ success: false, message: 'Token invalide' }, { status: 400 });
    }

    // Créer la session locale (cookie)
    await createSessionCookie(user);

    authAudit.success('MAGIC_LINK_VERIFIED_AND_SESSION_CREATED', {
      ip,
      userId: user.id,
      role: user.role,
    });

    return NextResponse.json({ success: true, user });
  } catch (err: any) {
    authAudit.error('MAGIC_LINK_VERIFY_ERROR', { error: err.message, ip });
    return NextResponse.json({ success: false, message: 'Lien magique invalide ou expiré' }, { status: 401 });
  }
}
