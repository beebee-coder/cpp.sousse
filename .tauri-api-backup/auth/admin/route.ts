export const dynamic = 'force-dynamic';
export const revalidate = false;

import { NextRequest, NextResponse } from 'next/server';
import { approveUser, rejectUser, getAllUsers, listPendingUsers } from '@/lib/auth-users';

export async function GET() {
  const pending = await listPendingUsers();
  const users = await getAllUsers();
  const approved = users.filter((u) => u.approved);
  const stats = {
    total: users.length - 1, // exclude admin
    approved: approved.length - 1, // exclude admin
    pending: pending.length,
  };
  return NextResponse.json({ pending, users: approved, stats });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const userId = String(body?.userId ?? '').trim();
  const action = String(body?.action ?? 'approve').trim();

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Identifiant utilisateur requis.' }, { status: 400 });
  }

  if (action === 'reject') {
    const rejected = await rejectUser(userId);
    if (!rejected) {
      return NextResponse.json({ success: false, message: 'Utilisateur introuvable.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Utilisateur rejeté.' });
  }

  const approved = await approveUser(userId);
  if (!approved) {
    return NextResponse.json({ success: false, message: 'Utilisateur introuvable.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, user: approved });
}
