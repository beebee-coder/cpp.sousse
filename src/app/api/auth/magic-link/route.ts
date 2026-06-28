import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/session';
import { SignJWT } from 'jose';
import { authAudit } from '@/lib/auth-audit';

const SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';
const encodedSecret = new TextEncoder().encode(SECRET);

/**
 * GET /api/auth/magic-link
 * Génère un lien profond (Deep Link) avec un JWT sécurisé pour l'auto-login vers l'application Tauri.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'NON_AUTHENTIFIÉ' }, { status: 401 });
    }

    const { user } = session;

    // Créer un JWT valide pour 5 minutes
    const token = await new SignJWT({ user })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m') // Très court pour la sécurité
      .sign(encodedSecret);

    authAudit.info('MAGIC_LINK_GENERATED', { userId: user.id, role: user.role });

    const deepLink = `visionode://login?token=${token}`;

    return NextResponse.json({ success: true, url: deepLink });
  } catch (err: any) {
    authAudit.error('MAGIC_LINK_ERROR', { error: err.message });
    return NextResponse.json({ success: false, error: 'Erreur lors de la génération du lien' }, { status: 500 });
  }
}
