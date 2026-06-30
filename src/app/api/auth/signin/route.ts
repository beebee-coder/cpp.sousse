import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-store';
import { signIn } from '@/auth';
import { authAudit } from '@/lib/auth-audit';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';

  try {
    const body = await request.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '');

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email et mot de passe requis.' }, { status: 400 });
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

    // Gestion des messages d'erreur spécifiques
    if (result.error === 'NOT_APPROVED') {
      return NextResponse.json({ 
        success: false, 
        message: 'Votre compte est en attente d\'approbation par l\'administrateur.' 
      }, { status: 403 });
    }

    if (result.error === 'DB_ERROR') {
      return NextResponse.json({ 
        success: false, 
        message: 'Erreur de liaison avec la base de données. Vérifiez DATABASE_URL.' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: false, 
      message: 'Identifiants invalides.' 
    }, { status: 401 });

  } catch (err) {
    authAudit.error('SIGNIN_INTERNAL_ERROR', {
      ip,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ success: false, message: 'Erreur système lors de la connexion.' }, { status: 500 });
  }
}
