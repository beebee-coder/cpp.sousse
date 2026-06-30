
import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-store';
import { signIn } from '@/auth';
import { authAudit } from '@/lib/auth-audit';

export const dynamic = 'force-dynamic';

/**
 * Route d'authentification ultra-résiliente.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email ?? '').trim();
    const password = String(body?.password ?? '');

    if (!email || !password) {
      return NextResponse.json({ 
        success: false, 
        message: 'Email et mot de passe requis.' 
      }, { status: 400 });
    }

    authAudit.info('SIGNIN_ATTEMPT', { email });

    // Appel au magasin d'authentification (inclut l'accès Prisma sécurisé)
    const result = await authenticateUser(email, password);

    if (result.success && result.user) {
      try {
        await signIn({
          id: result.user.id,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role,
        });
        
        authAudit.success('SIGNIN_SUCCESS', { userId: result.user.id, email });
        return NextResponse.json({ success: true, user: result.user });
      } catch (sessionErr: any) {
        authAudit.error('SESSION_CREATION_ERROR', { error: sessionErr.message });
        return NextResponse.json({ 
          success: false, 
          message: 'Erreur technique lors de la création de la session.' 
        }, { status: 500 });
      }
    }

    // Mappage des erreurs métier
    const errorMap: Record<string, { msg: string, status: number }> = {
      'NOT_APPROVED': { msg: 'Compte en attente d\'approbation par l\'administrateur.', status: 403 },
      'DB_ERROR': { msg: 'La base de données Neon est actuellement injoignable.', status: 503 },
      'INVALID_CREDENTIALS': { msg: 'Identifiants incorrects.', status: 401 }
    };

    const errorDetail = errorMap[result.error || 'INVALID_CREDENTIALS'];
    
    return NextResponse.json({ 
      success: false, 
      message: errorDetail.msg 
    }, { status: errorDetail.status });

  } catch (err: any) {
    authAudit.error('SIGNIN_CRITICAL_EXCEPTION', { error: err.message });
    return NextResponse.json({ 
      success: false, 
      message: 'Erreur critique du service d\'authentification.' 
    }, { status: 500 });
  }
}
