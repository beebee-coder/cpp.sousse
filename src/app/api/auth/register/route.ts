export const dynamic = 'force-dynamic';
export const revalidate = false;
import { NextRequest, NextResponse } from 'next/server';
import { addPendingUser } from '@/lib/auth-users';
import { Role } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, password, role } = body;

    // Validation des champs requis
    if (!firstName || !lastName || !password) {
      return NextResponse.json(
        { error: 'Tous les champs sont requis' },
        { status: 400 }
      );
    }

    // Valider que le rôle est valide (si fourni)
    let validRole: Role = Role.user;
    if (role) {
      // Vérifier si le rôle est valide dans l'enum Role
      const roleValues = Object.values(Role);
      if (roleValues.includes(role as Role)) {
        validRole = role as Role;
      } else {
        return NextResponse.json(
          { error: 'Rôle invalide' },
          { status: 400 }
        );
      }
    }

    const result = await addPendingUser(
      firstName,
      lastName,
      password,
      validRole
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Vérifier que result.user existe avant de l'utiliser
    if (!result.user) {
      return NextResponse.json(
        { error: 'Utilisateur créé mais données non disponibles' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: result.user.id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        email: result.user.email,
        role: result.user.role,
        approved: result.user.approved
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ [REGISTER] Erreur:', error.message);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
