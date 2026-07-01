
import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-store';
import { signIn } from '@/auth';

export const dynamic = 'force-dynamic';

/**
 * Route d'authentification blindée avec logs structurés [AUTH_API].
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  
  console.log(`🚀 [AUTH_API] [INIT] Réception d'une demande de liaison.`);

  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email ?? '').trim();
    const password = String(body?.password ?? '');

    if (!email || !password) {
      console.warn(`❌ [AUTH_API] [REJECT] Identifiants manquants dans le payload.`);
      return NextResponse.json({ success: false, message: 'Email et mot de passe requis.' }, { status: 400 });
    }

    console.log(`📡 [AUTH_API] [STEP] Interrogation du magasin d'identités : ${email}`);
    const result = await authenticateUser(email, password);

    if (result.success && result.user) {
      console.log(`🔑 [AUTH_API] [STEP] Création de la session sécurisée (JWT/Cookie)...`);
      try {
        await signIn({
          id: result.user.id,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role,
        });
        
        console.log(`✅ [AUTH_API] [SUCCESS] Liaison établie pour : ${result.user.id}`);
        return NextResponse.json({ success: true, user: result.user });
      } catch (sessionErr: any) {
        console.error(`❌ [AUTH_API] [ERROR] Échec création session locale :`, sessionErr.message);
        return NextResponse.json({ success: false, message: 'Erreur technique session.' }, { status: 500 });
      }
    }

    const errorMap: Record<string, { msg: string, status: number }> = {
      'NOT_APPROVED': { msg: 'Compte en attente d\'approbation administrateur.', status: 403 },
      'DB_ERROR': { msg: 'Base de données Neon injoignable.', status: 503 },
      'INVALID_CREDENTIALS': { msg: 'Identifiants incorrects.', status: 401 }
    };

    const errorDetail = errorMap[result.error || 'INVALID_CREDENTIALS'];
    console.warn(`❌ [AUTH_API] [REJECT] Raison : ${errorDetail.msg}`);
    
    return NextResponse.json({ 
      success: false, 
      message: errorDetail.msg 
    }, { status: errorDetail.status });

  } catch (err: any) {
    console.error(`❌ [AUTH_API] [FATAL] Panique critique :`, err.message);
    return NextResponse.json({ success: false, message: 'Panique critique du service d\'authentification.' }, { status: 500 });
  }
}
