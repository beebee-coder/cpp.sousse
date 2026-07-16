export const dynamic = 'force-dynamic';
export const revalidate = false;

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/session';
import { getAllUsers, updateUserRole, updateUserApproval, deleteUser, getUserStats } from '@/lib/auth-store';
import { Role } from '@prisma/client';

export async function GET() {
  const session = await getSessionFromCookie();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const users = await getAllUsers();
    const stats = await getUserStats();

    return NextResponse.json({
      success: true,
      users,
      stats
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromCookie();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { userId, role, approved } = body as {
      userId: string;
      role?: Role;
      approved?: boolean;
    };

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId requis' }, { status: 400 });
    }

    if (userId === session.user.id) {
      return NextResponse.json({ success: false, error: 'Impossible de modifier votre propre compte.' }, { status: 400 });
    }

    let result;
    if (role !== undefined) {
      result = await updateUserRole(userId, role);
    } else if (approved !== undefined) {
      result = await updateUserApproval(userId, approved);
    } else {
      return NextResponse.json({ success: false, error: 'Aucune modification spécifiée' }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, user: result.user });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionFromCookie();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { userId } = body as { userId: string };

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId requis' }, { status: 400 });
    }

    if (userId === session.user.id) {
      return NextResponse.json({ success: false, error: 'Impossible de supprimer votre propre compte.' }, { status: 400 });
    }

    const result = await deleteUser(userId);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
