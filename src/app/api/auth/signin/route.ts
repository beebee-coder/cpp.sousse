import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-users';
import { signIn } from '@/auth';
import { authAudit } from '@/lib/auth-audit';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
  const userAgent = request.headers.get('user-agent') ?? 'unknown';

  authAudit.info('SIGNIN_ATTEMPT', { ip, userAgent });

  try {
    const body = await request.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '');

    if (!email || !password) {
      authAudit.warn('SIGNIN_MISSING_FIELDS', { ip, email: email || '(empty)', passwordProvided: !!password });
      return NextResponse.json({ success: false, message: 'Email et mot de passe requis.' }, { status: 400 });
    }

    authAudit.info('SIGNIN_CREDENTIALS_RECEIVED', { ip, email });

    const user = await authenticateUser(email, password);

    if (!user) {
      authAudit.warn('SIGNIN_FAILED', { ip, email, reason: 'Identifiants invalides ou compte non approuvé' });
      return NextResponse.json({ success: false, message: 'Identifiants invalides ou compte non approuvé.' }, { status: 401 });
    }

    authAudit.info('SIGNIN_USER_AUTHENTICATED', { ip, email, userId: user.id, role: user.role });

    await signIn({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });

    authAudit.success('SIGNIN_SESSION_CREATED', {
      ip,
      email,
      userId: user.id,
      role: user.role,
      name: `${user.firstName} ${user.lastName}`,
    });

    return NextResponse.json({ success: true, user });
  } catch (err) {
    authAudit.error('SIGNIN_INTERNAL_ERROR', {
      ip,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ success: false, message: 'Erreur de connexion.' }, { status: 500 });
  }
}
