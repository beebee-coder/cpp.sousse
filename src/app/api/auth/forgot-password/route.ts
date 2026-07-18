export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { SignJWT } from 'jose';
import { corsPreflight, withCors } from '@/lib/cors';

const SECRET = process.env.AUTH_SECRET;
const encodedSecret = new TextEncoder().encode(SECRET || '');

export async function OPTIONS(request: NextRequest) {
  return corsPreflight(request.headers.get('origin'));
}

/**
 * POST /api/auth/forgot-password
 * Génère un jeton JWT de réinitialisation (15 min) pour l'email fourni.
 * Aucune infrastructure SMTP n'étant configurée, le jeton est renvoyé au
 * client afin de poursuivre le flux localement (comportement identique au
 * magic-link existant). Réponse générique pour éviter l'énumération d'utilisateurs.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  try {
    const body = await request.json();
    const email = (body?.email ?? '').toLowerCase().trim();

    if (!email) {
      return withCors(
        NextResponse.json({ success: false, message: 'Adresse email requise.' }, { status: 400 }),
        origin
      );
    }

    const prisma = await getPrisma();
    const user = prisma ? await prisma.user.findUnique({ where: { email } }) : null;

    if (!user) {
      return withCors(
        NextResponse.json({
          success: true,
          message: 'Si ce compte existe, un lien de réinitialisation a été généré.',
        }),
        origin
      );
    }

    const token = await new SignJWT({ userId: user.id, purpose: 'password-reset' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(encodedSecret);

    return withCors(
      NextResponse.json({
        success: true,
        message: 'Si ce compte existe, un lien de réinitialisation a été généré.',
        resetToken: token,
      }),
      origin
    );
  } catch (err: any) {
    console.error('[FORGOT_PASSWORD] Erreur:', err?.message);
    return withCors(
      NextResponse.json({ success: false, message: 'Erreur interne du serveur.' }, { status: 500 }),
      origin
    );
  }
}
