export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-store';
import { createSessionCookie } from '@/lib/session';
import { corsPreflight, withCors } from '@/lib/cors';

// Authentification : toujours dynamique (cookies + DB).

export async function OPTIONS(request: NextRequest) {
  return corsPreflight(request.headers.get('origin'));
}

export async function POST(request: NextRequest) {
  const ts = new Date().toLocaleTimeString();
  const origin = request.headers.get('origin');

  try {
    const body = await request.json();
    
    console.log(`🔐 [AUTH_API] [${ts}] Tentative pour: ${body?.email}`);

    if (!body || !body.email || !body.password) {
      console.warn(`⚠️ [AUTH_API] Requête malformée`);
      return withCors(
        NextResponse.json(
          { success: false, message: 'Identifiants requis.' },
          { status: 400 }
        ),
        origin
      );
    }

    // ✅ Appel à la fonction d'authentification
    const result = await authenticateUser(body.email, body.password);
    
    console.log(`🔐 [AUTH_API] Résultat:`, result);

    if (result.success && result.user) {
      console.log(`✅ [AUTH_API] Succès pour: ${body.email}`);
      
      await createSessionCookie({
        id: result.user.id,
        firstName: result.user.firstName ?? "",
        lastName: result.user.lastName ?? "",
        role: result.user.role,
      });
      
      return withCors(
        NextResponse.json({ success: true, user: result.user }),
        origin
      );
    }

    console.log(`❌ [AUTH_API] Échec: ${result.error}`);
    return withCors(
      NextResponse.json(
        { success: false, message: result.error || 'Identifiants incorrects.' },
        { status: 401 }
      ),
      origin
    );

  } catch (error: unknown) {
    const err = error as Error;
    console.error(`❌ [AUTH_API] Erreur:`, err.message);
    console.error(`📄 Stack:`, err.stack);
    return withCors(
      NextResponse.json(
        { success: false, message: 'Erreur interne du serveur.' },
        { status: 500 }
      ),
      origin
    );
  }
}
