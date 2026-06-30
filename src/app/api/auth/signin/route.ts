import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-store';
import { signIn } from '@/auth';
import { authAudit } from '@/lib/auth-audit';

export const dynamic = 'force-dynamic';

/**
 * Point d'entrée de connexion robuste.
 * Garantit une réponse JSON même en cas de défaillance majeure de la base de données.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body?.email ?? '').trim();
    const password = String(body?.password ?? '');

    if (!email || !password) {
      return NextResponse.json({ 
        success: false, 
        message: 'Identifiants requis.' 
      }, { status: 400 });
    }

    const result = await authenticateUser(email, password);

    if (result.success && result.user) {
      await signIn({
        id: result.user.id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
      });

      return NextResponse.json({ success: true, user: result.user });
    }

    // Cartographie des erreurs métier
    if (result.error === 'NOT_APPROVED') {
      return NextResponse.json({ 
        success: false, 
        message: 'Compte en attente d\'approbation par l\'administrateur.' 
      }, { status: 403 });
    }

    if (result.error === 'DB_ERROR') {
      return NextResponse.json({ 
        success: false, 
        message: 'Liaison interrompue avec le serveur de données Neon.' 
      }, { status: 503 });
    }

    return NextResponse.json({ 
      success: false, 
      message: 'Email ou clé d\'accès invalide.' 
    }, { status: 401 });

  } catch (err: any) {
    authAudit.error('SIGNIN_CRITICAL_FAILURE', { error: err.message });
    return NextResponse.json({ 
      success: false, 
      message: 'Le service d\'authentification est momentanément indisponible.' 
    }, { status: 500 });
  }
}
