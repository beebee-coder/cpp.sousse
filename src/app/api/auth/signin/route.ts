import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-store';
import { createSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * API Route d'accréditation VisioNode V8.1.0.
 * Traçabilité totale et retour JSON strict.
 */
export async function POST(request: NextRequest) {
  const ts = new Date().toLocaleTimeString();
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.email || !body.password) {
      return NextResponse.json({ success: false, message: 'Identifiants de contrôle requis.' }, { status: 400 });
    }

    console.log(`🚀 [AUTH_API] [INIT] [${ts}] Demande de liaison pour ${body.email} (IP: ${ip})`);

    const result = await authenticateUser(body.email, body.password);

    if (result.success && result.user) {
      console.log(`🚀 [AUTH_API] [STEP] Liaison validée. Création du jeton de session.`);
      
      await createSessionCookie({
        id: result.user.id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
      });
      
      console.log(`✅ [AUTH_API] [SUCCESS] Liaison de contrôle établie.`);
      return NextResponse.json({ success: true, user: result.user });
    }

    // Gestion des rejets spécifiques
    let status = 401;
    let message = 'Accréditation refusée (Clé incorrecte).';

    if (result.error === 'NOT_APPROVED') {
      message = 'Compte en attente d\'approbation administrateur.';
    } else if (result.error === 'OAUTH_ACCOUNT') {
      message = 'Ce compte utilise une connexion tierce (OAuth).';
    }

    console.warn(`🚀 [AUTH_API] [REJECT] ${message}`);
    return NextResponse.json({ success: false, message }, { status });

  } catch (err: any) {
    console.error(`❌ [AUTH_API] [FATAL] [${ts}] Panique critique :`, err.message);
    return NextResponse.json({ 
      success: false, 
      message: 'Erreur interne de liaison système.',
      diagnostic: err.message
    }, { status: 500 });
  }
}
