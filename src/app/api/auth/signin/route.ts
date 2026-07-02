import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-store';
import { signIn } from '@/auth';

export const dynamic = 'force-dynamic';

/**
 * Route d'authentification avec logs structurés [AUTH_API].
 * Version 7.8.5 : Sécurisation totale des retours JSON.
 */
export async function POST(request: NextRequest) {
  const ts = new Date().toLocaleTimeString();
  console.log(`🚀 [AUTH_API] [INIT] [${ts}] Réception d'une demande de liaison.`);

  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email ?? '').trim();
    const password = String(body?.password ?? '');

    if (!email || !password) {
      console.warn(`🚀 [AUTH_API] [REJECT] [${ts}] Identifiants manquants.`);
      return NextResponse.json({ success: false, message: 'Email et mot de passe requis.' }, { status: 400 });
    }

    console.log(`🚀 [AUTH_API] [STEP] [${ts}] Transmission au magasin d'identités : ${email}`);
    const result = await authenticateUser(email, password);

    if (result.success && result.user) {
      console.log(`🚀 [AUTH_API] [STEP] [${ts}] Génération de la session sécurisée pour : ${result.user.id}`);
      await signIn({
        id: result.user.id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
      });
      
      console.log(`🚀 [AUTH_API] [SUCCESS] [${ts}] Liaison établie avec succès.`);
      return NextResponse.json({ success: true, user: result.user });
    }

    const errorMsg = result.error === 'NOT_APPROVED' 
      ? 'Compte en attente d\'approbation.' 
      : 'Identifiants incorrects.';
      
    console.warn(`🚀 [AUTH_API] [REJECT] [${ts}] Raison : ${errorMsg}`);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 401 });

  } catch (err: any) {
    console.error(`🚀 [AUTH_API] [FATAL] [${ts}] Panique critique du service :`, err.message);
    return NextResponse.json({ 
      success: false, 
      message: 'Erreur interne de liaison (Vérifiez la config Prisma/Neon).',
      error: err.message
    }, { status: 500 });
  }
}
