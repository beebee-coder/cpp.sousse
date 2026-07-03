import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-store';
import { createSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ts = new Date().toLocaleTimeString();

  try {
    const body = await request.json();
    
    console.log(`🔐 [AUTH_API] [${ts}] Tentative pour: ${body?.email}`);

    if (!body || !body.email || !body.password) {
      console.warn(`⚠️ [AUTH_API] Requête malformée`);
      return NextResponse.json(
        { success: false, message: 'Identifiants requis.' },
        { status: 400 }
      );
    }

    // ✅ Appel à la fonction d'authentification
    const result = await authenticateUser(body.email, body.password);
    
    console.log(`🔐 [AUTH_API] Résultat:`, result);

    if (result.success && result.user) {
      console.log(`✅ [AUTH_API] Succès pour: ${body.email}`);
      
      await createSessionCookie({
        id: result.user.id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
      });
      
      return NextResponse.json({ 
        success: true, 
        user: result.user 
      });
    }

    console.log(`❌ [AUTH_API] Échec: ${result.error}`);
    return NextResponse.json(
      { success: false, message: result.error || 'Identifiants incorrects.' },
      { status: 401 }
    );

  } catch (err: any) {
    console.error(`❌ [AUTH_API] Erreur:`, err.message);
    console.error(`📄 Stack:`, err.stack);
    return NextResponse.json(
      { success: false, message: 'Erreur interne du serveur.' },
      { status: 500 }
    );
  }
}
