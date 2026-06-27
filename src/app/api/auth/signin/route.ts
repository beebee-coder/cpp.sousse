import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-users';
import { signIn } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const firstName = String(body?.firstName ?? '').trim();
    const lastName = String(body?.lastName ?? '').trim();
    const password = String(body?.password ?? '').trim();
    const role = String(body?.role ?? '').trim() || undefined;

    const user = await authenticateUser(firstName, lastName, password, role);

    if (!user) {
      return NextResponse.json({ success: false, message: 'Identifiants invalides.' }, { status: 401 });
    }

    await signIn({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });

    return NextResponse.json({ success: true, user });
  } catch {
    return NextResponse.json({ success: false, message: 'Erreur de connexion.' }, { status: 500 });
  }
}
