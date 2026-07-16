import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { getPrisma } from '@/lib/db';

// ============================================================
// 🔐 AUTHENTIFICATION
// ============================================================

export async function authenticateUser(email: string, password: string) {
  const ts = new Date().toLocaleTimeString();
  const normalizedEmail = email.toLowerCase().trim();
  const prisma = await getPrisma();

  console.log(`📡 [AUTH_STORE] [${ts}] Tentative pour: ${normalizedEmail}`);

  try {
    if (!prisma) {
      console.error('❌ [AUTH_STORE] Prisma non disponible');
      return { success: false, error: 'DB_UNAVAILABLE' };
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user) {
      console.warn(`⚠️ [AUTH_STORE] Utilisateur non trouvé: ${normalizedEmail}`);
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    console.log(`✅ [AUTH_STORE] Utilisateur trouvé: ${user.email}`);

    if (!user.password) {
      console.warn(`⚠️ [AUTH_STORE] Pas de mot de passe pour: ${email}`);
      return { success: false, error: 'OAUTH_ACCOUNT' };
    }

    let isValid = false;
    try {
      isValid = await bcrypt.compare(password, user.password);
      console.log(`   bcrypt.compare: ${isValid}`);
    } catch (bcryptError: any) {
      console.error(`❌ [AUTH_STORE] Erreur bcrypt:`, bcryptError.message);
      return { success: false, error: 'AUTH_ERROR' };
    }

    if (!isValid) {
      console.warn(`⚠️ [AUTH_STORE] Mot de passe incorrect pour: ${email}`);
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    if (!user.approved && user.role !== Role.admin) {
      console.warn(`⚠️ [AUTH_STORE] Compte non approuvé: ${email}`);
      return { success: false, error: 'NOT_APPROVED' };
    }

    console.log(`✅ [AUTH_STORE] Authentification réussie pour: ${email}`);

    return {
      success: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        approved: user.approved,
        createdAt: user.createdAt.getTime()
      }
    };
  } catch (error: any) {
    console.error(`❌ [AUTH_STORE] Erreur fatale:`, error.message);
    return { success: false, error: 'AUTH_ERROR' };
  }
}

// ============================================================
// 👤 GESTION DES UTILISATEURS
// ============================================================

export async function addPendingUser(firstName: string, lastName: string, password: string, role: Role = Role.user) {
  const prisma = await getPrisma();
  try {
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@visionode.local`;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: 'USER_ALREADY_EXISTS' };
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role: role,
        approved: role === Role.admin,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    return { success: true, user };
  } catch (error: any) {
    console.error('❌ [AUTH_STORE] Erreur addPendingUser:', error.message);
    return { success: false, error: 'DB_ERROR' };
  }
}

export async function listPendingUsers() {
  const prisma = await getPrisma();
  try {
    const users = await prisma.user.findMany({
      where: { approved: false },
      orderBy: { createdAt: 'desc' }
    });
    return users;
  } catch (error: any) {
    console.error('❌ [AUTH_STORE] Erreur listPendingUsers:', error.message);
    return [];
  }
}

export async function approveUser(userId: string) {
  const prisma = await getPrisma();
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { approved: true, updatedAt: new Date() }
    });
    return { success: true, user };
  } catch (error: any) {
    console.error('❌ [AUTH_STORE] Erreur approveUser:', error.message);
    return { success: false, error: 'DB_ERROR' };
  }
}

export async function rejectUser(userId: string) {
  const prisma = await getPrisma();
  try {
    await prisma.user.delete({ where: { id: userId } });
    return { success: true };
  } catch (error: any) {
    console.error('❌ [AUTH_STORE] Erreur rejectUser:', error.message);
    return { success: false, error: 'DB_ERROR' };
  }
}

export async function getAllUsers() {
  const prisma = await getPrisma();
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return users;
  } catch (error: any) {
    console.error('❌ [AUTH_STORE] Erreur getAllUsers:', error.message);
    return [];
  }
}

export async function getUserById(userId: string) {
  const prisma = await getPrisma();
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      approved: user.approved,
      image: user.image,
      createdAt: user.createdAt.getTime(),
    };
  } catch (error: any) {
    console.error('❌ [AUTH_STORE] Erreur getUserById:', error.message);
    return null;
  }
}

export async function verifyUserPassword(userId: string, password: string) {
  const prisma = await getPrisma();
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) return false;
    return await bcrypt.compare(password, user.password);
  } catch (error: any) {
    console.error('❌ [AUTH_STORE] Erreur verifyUserPassword:', error.message);
    return false;
  }
}

export async function updateUserRole(userId: string, role: Role) {
  const prisma = await getPrisma();
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role, updatedAt: new Date() }
    });
    return { success: true, user };
  } catch (error: any) {
    console.error('❌ [AUTH_STORE] Erreur updateUserRole:', error.message);
    return { success: false, error: 'DB_ERROR' };
  }
}

export async function updateUserApproval(userId: string, approved: boolean) {
  const prisma = await getPrisma();
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { approved, updatedAt: new Date() }
    });
    return { success: true, user };
  } catch (error: any) {
    console.error('❌ [AUTH_STORE] Erreur updateUserApproval:', error.message);
    return { success: false, error: 'DB_ERROR' };
  }
}

export async function deleteUser(userId: string) {
  const prisma = await getPrisma();
  try {
    await prisma.user.delete({ where: { id: userId } });
    return { success: true };
  } catch (error: any) {
    console.error('❌ [AUTH_STORE] Erreur deleteUser:', error.message);
    return { success: false, error: 'DB_ERROR' };
  }
}

export async function getUserStats() {
  const prisma = await getPrisma();
  try {
    const total = await prisma.user.count();
    const byRole = await prisma.user.groupBy({
      by: ['role'],
      _count: { role: true }
    });
    const pending = await prisma.user.count({ where: { approved: false } });
    const approved = await prisma.user.count({ where: { approved: true } });
    return {
      total,
      byRole: byRole.reduce((acc, item) => ({ ...acc, [item.role]: item._count.role }), {} as Record<string, number>),
      pending,
      approved
    };
  } catch (error: any) {
    console.error('❌ [AUTH_STORE] Erreur getUserStats:', error.message);
    return null;
  }
}

export async function updateCurrentUser(
  userId: string,
  data: { firstName?: string; lastName?: string; email?: string; password?: string; image?: string | null }
) {
  const prisma = await getPrisma();
  try {
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return { success: false, error: 'USER_NOT_FOUND' };
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;

    if (data.email !== undefined) {
      const normalizedEmail = data.email.toLowerCase().trim();
      if (normalizedEmail !== existing.email) {
        const emailExists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (emailExists) {
          return { success: false, error: 'EMAIL_ALREADY_EXISTS' };
        }
        updateData.email = normalizedEmail;
      }
    }

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 12);
    }

    if (data.image !== undefined) {
      updateData.image = data.image === '' ? null : data.image;
    }

    const user = await prisma.user.update({ where: { id: userId }, data: updateData });

    return {
      success: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        approved: user.approved,
        image: user.image,
        createdAt: user.createdAt.getTime(),
      },
    };
  } catch (error: any) {
    console.error('❌ [AUTH_STORE] Erreur updateCurrentUser:', error.message);
    return { success: false, error: 'DB_ERROR' };
  }
}
