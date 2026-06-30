import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-store';
import { signIn } from '@/auth';
import { authAudit } from '@/lib/auth-audit';

export const dynamic = 'force-dynamic';

/**
 * Route d'authentification robuste.
 * Garantit une réponse JSON constante pour éviter les erreurs de parsing client.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email ?? '').trim();
    const password = String(body?.password ?? '');

    if (!email || !password) {
      return NextResponse.json({ 
        success: false, 
        message: 'Identifiants requis.' 
      }, { status: 400 });
    }

    authAudit.info('SIGNIN_ATTEMPT', { email });

    const result = await authenticateUser(email, password);

    if (result.success && result.user) {
      // Création de la session via cookie JWT
      await signIn({
        id: result.user.id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
      });

      authAudit.success('SIGNIN_SUCCESS', { userId: result.user.id, email });
      return NextResponse.json({ success: true, user: result.user });
    }

    // Gestion des erreurs métier
    const errorMap: Record<string, { msg: string, status: number }> = {
      'NOT_APPROVED': { msg: 'Compte en attente d\'approbation par l\'administrateur.', status: 403 },
      'DB_ERROR': { msg: 'Liaison interrompue avec le serveur de données Neon.', status: 503 },
      'INVALID_CREDENTIALS': { msg: 'Email ou clé d\'accès invalide.', status: 401 }
    };

    const errorDetail = errorMap[result.error || 'INVALID_CREDENTIALS'];
    return NextResponse.json({ 
      success: false, 
      message: errorDetail.msg 
    }, { status: errorDetail.status });

  } catch (err: any) {
    authAudit.error('SIGNIN_CRITICAL_EXCEPTION', { error: err.message });
    
    // On renvoie TOUJOURS du JSON, même en cas de crash total
    return NextResponse.json({ 
      success: false, 
      message: 'Le service d\'authentification est momentanément indisponible. Erreur réseau ou base de données.' 
    }, { status: 500 });
  }
}
