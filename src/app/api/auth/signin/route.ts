import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-store';
import { createSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Route d'authentification avec traçabilité industrielle [AUTH_API].
 * Version 7.8.5 : Diagnostic complet du corps de réponse.
 */
export async function POST(request: NextRequest) {
  const ts = new Date().toLocaleTimeString();
  console.log(`🚀 [AUTH_API] [INIT] [${ts}] Réception d'une demande de liaison.`);

  try {
    const body = await request.json().catch(() => null);
    
    if (!body) {
      console.warn(`🚀 [AUTH_API] [REJECT] [${ts}] Payload JSON invalide ou absent.`);
      return NextResponse.json({ success: false, message: 'Requête invalide.' }, { status: 400 });
    }

    const email = String(body.email || '').trim();
    const password = String(body.password || '');

    if (!email || !password) {
      console.warn(`🚀 [AUTH_API] [REJECT] [${ts}] Identifiants de contrôle manquants.`);
      return NextResponse.json({ success: false, message: 'Email et mot de passe requis.' }, { status: 400 });
    }

    console.log(`🚀 [AUTH_API] [STEP] [${ts}] Interrogation du magasin : ${email}`);
    const result = await authenticateUser(email, password);

    if (result.success && result.user) {
      console.log(`🚀 [AUTH_API] [STEP] [${ts}] Liaison validée. Création du jeton de session.`);
      
      await createSessionCookie({
        id: result.user.id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
      });
      
      console.log(`✅ [AUTH_API] [SUCCESS] [${ts}] Liaison de contrôle établie pour ${result.user.id}.`);
      return NextResponse.json({ success: true, user: result.user });
    }

    const errorMsg = result.error === 'NOT_APPROVED' 
      ? 'Compte en attente d\'approbation administrateur.' 
      : 'Accréditation refusée (Identifiants incorrects).';
      
    console.warn(`🚀 [AUTH_API] [REJECT] [${ts}] Raison : ${errorMsg}`);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 401 });

  } catch (err: any) {
    console.error(`❌ [AUTH_API] [FATAL] [${ts}] Panique critique :`, err.message);
    
    return NextResponse.json({ 
      success: false, 
      message: 'Erreur interne de liaison système.',
      diagnostic: err.message
    }, { status: 500 });
  }
}
