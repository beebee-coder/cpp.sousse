export const dynamic = 'force-dynamic';
export const revalidate = false;
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { getSessionFromCookie } from '@/lib/session';

/**
 * GET /api/auth/pending-count
 * Retourne le nombre d'utilisateurs en attente d'approbation.
 * Réservé au rôle admin.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    const user = session?.user;

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const count = await prisma.user.count({
      where: { approved: false },
    });

    return NextResponse.json({ count });
  } catch (err: any) {
    console.error('[API/PENDING-COUNT]', err.message);
    return NextResponse.json({ count: 0 });
  }
}
