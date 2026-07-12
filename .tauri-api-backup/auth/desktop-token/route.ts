export const dynamic = 'force-dynamic';
export const revalidate = false;
import { auth } from '@/lib/auth';
import { getUserById } from '@/lib/auth-store';
import { createDesktopHandoffToken } from '@/lib/session';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Non authentifié' }, { status: 401 });
    }

    // Enrichir avec l'e-mail (absent du cookie de session) pour une identité complète.
    const dbUser = session.user.id ? await getUserById(session.user.id) : null;

    const token = await createDesktopHandoffToken({
      id: session.user.id,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      role: session.user.role,
      email: dbUser?.email ?? '',
    });

    return NextResponse.json({ success: true, token });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Erreur interne' }, { status: 500 });
  }
}
