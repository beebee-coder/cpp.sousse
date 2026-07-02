import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-store';
import { createSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * API Route d'accréditation VisioNode V8.2.0.
 * Traçabilité totale et garantie de retour JSON strict.
 */
export async function POST(request: NextRequest) {
  const ts = new Date().toLocaleTimeString();
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

  try {
    const body = await request.json().catch(() => null);
    
    if (!body || !body.email || !body.password) {
      console.warn(`🚀 [AUTH_API] [REJECT] [${ts}] Requête malformée de ${ip}`);
      return NextResponse.json({ success: false, message: 'Identifiants de contrôle requis.' }, { status: 400 });
    }

    console.log(`🚀 [AUTH_API] [INIT] [${ts}] Demande de liaison pour ${body.email}`);

    const result = await authenticateUser(body.email, body.password);

    if (result.success && result.user) {
      console.log(`🚀 [AUTH_API] [STEP] Liaison validée par le magasin d'identités.`);
      
      await createSessionCookie({
        id: result.user.id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
      });
      
      console.log(`✅ [AUTH_API] [SUCCESS] Session souveraine établie.`);
      return NextResponse.json({ success: true, user: result.user });
    }

    // Gestion des rejets spécifiques (Codes métiers)
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
    console.error(`❌ [AUTH_API] [FATAL] [${ts}] Rupture critique :`, err.message);
    
    // Crucial : Toujours renvoyer du JSON même en cas de panique
    return NextResponse.json({ 
      success: false, 
      message: 'Erreur interne de liaison système.',
      diagnostic: err.message
    }, { status: 500 });
  }
}
