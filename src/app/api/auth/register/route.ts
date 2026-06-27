import { NextRequest, NextResponse } from 'next/server';
import { addPendingUser } from '@/lib/auth-users';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const firstName = String(body?.firstName ?? '').trim();
    const lastName = String(body?.lastName ?? '').trim();
    const password = String(body?.password ?? '').trim();
    const role = String(body?.role ?? 'user').trim();

    if (!firstName || !lastName || !password) {
      return NextResponse.json(
        { success: false, message: 'Prénom, nom et mot de passe sont requis.' },
        { status: 400 },
      );
    }

    const created = await addPendingUser(firstName, lastName, password, role);
    if (!created) {
      return NextResponse.json(
        { success: false, message: 'Cet utilisateur existe déjà ou est déjà en attente.' },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Demande d’accès envoyée à l’administrateur. Veuillez attendre la validation.',
    });
  } catch (error: any) {
    console.error('[API AUTH REGISTER] Error:', error?.message || error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur lors de l’enregistrement de la demande.' },
      { status: 500 },
    );
  }
}
