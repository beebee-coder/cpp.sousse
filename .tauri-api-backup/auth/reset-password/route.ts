export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { updateCurrentUser } from '@/lib/auth-store';
import { corsPreflight, withCors } from '@/lib/cors';

const SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';
const encodedSecret = new TextEncoder().encode(SECRET);

export async function OPTIONS(request: NextRequest) {
  return corsPreflight(request.headers.get('origin'));
}

/**
 * POST /api/auth/reset-password
 * Vérifie le jeton JWT de réinitialisation et applique le nouveau mot de passe.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  try {
    const body = await request.json();
    const token = body?.token;
    const newPassword = body?.newPassword ?? '';

    if (!token) {
      return withCors(
        NextResponse.json({ success: false, message: 'Jeton manquant.' }, { status: 400 }),
        origin
      );
    }

    if (!newPassword || newPassword.length < 6) {
      return withCors(
        NextResponse.json({ success: false, message: 'Le nouveau mot de passe doit faire au moins 6 caractères.' }, { status: 400 }),
        origin
      );
    }

    const { payload } = await jwtVerify(token, encodedSecret, { algorithms: ['HS256'] });
    const { userId, purpose } = payload as any;

    if (purpose !== 'password-reset' || !userId) {
      return withCors(
        NextResponse.json({ success: false, message: 'Jeton invalide.' }, { status: 401 }),
        origin
      );
    }

    const result = await updateCurrentUser(userId, { password: newPassword });
    if (!result.success) {
      return withCors(
        NextResponse.json({ success: false, message: result.error || 'Échec de la réinitialisation.' }, { status: 400 }),
        origin
      );
    }

    return withCors(
      NextResponse.json({ success: true, message: 'Mot de passe réinitialisé avec succès.' }),
      origin
    );
  } catch (err: any) {
    console.error('[RESET_PASSWORD] Erreur:', err?.message);
    return withCors(
      NextResponse.json({ success: false, message: 'Lien de réinitialisation invalide ou expiré.' }, { status: 401 }),
      origin
    );
  }
}
