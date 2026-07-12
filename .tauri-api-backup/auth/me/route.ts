export const dynamic = 'force-dynamic';
export const revalidate = false;
import { auth } from '@/lib/auth';
import { getUserById, updateCurrentUser, verifyUserPassword } from '@/lib/auth-store';
import { createSessionCookie } from '@/lib/session';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  let user = null;
  if (session?.user?.id) {
    user = await getUserById(session.user.id);
  }
  return NextResponse.json({ session, user });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { firstName, lastName, email, currentPassword, newPassword, image } = body as {
      firstName?: string;
      lastName?: string;
      email?: string;
      currentPassword?: string;
      newPassword?: string;
      image?: string | null;
    };

    if (newPassword) {
      const valid = await verifyUserPassword(session.user.id, currentPassword ?? '');
      if (!valid) {
        return NextResponse.json({ success: false, error: 'INVALID_CURRENT_PASSWORD' }, { status: 400 });
      }
    }

    const result = await updateCurrentUser(session.user.id, {
      firstName,
      lastName,
      email,
      password: newPassword || undefined,
      image,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    const updated = result.user;
    if (!updated) {
      return NextResponse.json({ success: false, error: 'UPDATE_FAILED' }, { status: 500 });
    }

    // Rafraîchir le cookie de session pour refléter le nouveau nom/prénom
    await createSessionCookie({
      id: updated.id,
      firstName: updated.firstName ?? '',
      lastName: updated.lastName ?? '',
      role: updated.role,
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message ?? 'SERVER_ERROR' }, { status: 500 });
  }
}
