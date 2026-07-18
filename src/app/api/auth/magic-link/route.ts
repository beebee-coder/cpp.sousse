export const dynamic = 'force-dynamic';
export const revalidate = false;
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/session';
import { getUserById } from '@/lib/auth-store';
import { SignJWT } from 'jose';
import { authAudit } from '@/lib/auth-audit';

const SECRET = process.env.AUTH_SECRET;

/**
 * GET /api/auth/magic-link
 * Génère un lien profond (Deep Link) avec un JWT sécurisé pour l'auto-login vers l'application Tauri.
 * Mêmes claims (issuer/audience) que /api/auth/desktop-token afin que
 * /api/auth/verify-magic-link puisse les valider de façon identique.
 */
export async function GET(request: NextRequest) {
  if (!SECRET) {
    authAudit.error('MAGIC_LINK_MISSING_SECRET', {});
    return NextResponse.json({ success: false, error: 'Configuration serveur manquante' }, { status: 500 });
  }

  const encodedSecret = new TextEncoder().encode(SECRET);

  try {
    const session = await getSessionFromCookie();
    
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'NON_AUTHENTIFIÉ' }, { status: 401 });
    }

    const { user } = session;
    const dbUser = user.id ? await getUserById(user.id) : null;

    // Créer un JWT valide pour 5 minutes, signé et scopé (web → desktop).
    const token = await new SignJWT({
      user: {
        id: user.id,
        email: dbUser?.email ?? '',
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m') // Très court pour la sécurité
      .setIssuer('visionode-web')
      .setAudience('visionode-desktop')
      .sign(encodedSecret);

    authAudit.info('MAGIC_LINK_GENERATED', { userId: user.id, role: user.role });

    const deepLink = `visionode://auth?token=${token}`;

    return NextResponse.json({ success: true, url: deepLink });
  } catch (err: any) {
    authAudit.error('MAGIC_LINK_ERROR', { error: err.message });
    return NextResponse.json({ success: false, error: 'Erreur lors de la génération du lien' }, { status: 500 });
  }
}
