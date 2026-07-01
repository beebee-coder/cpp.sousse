import { prisma } from './db/prisma-client';
import bcrypt from 'bcryptjs';
import type { UserRole } from '@/lib/auth-users';

/**
 * Magasin d'identités avec logs structurés [AUTH_STORE].
 */
async function ensureAdminSeeded() {
  const ts = new Date().toLocaleTimeString();
  try {
    const adminEmail = 'admin@visionode.local';
    const admin = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (!admin) {
      console.log(`👤 [AUTH_STORE] [STEP] [${ts}] Auto-création de l'administrateur système...`);
      const hashedPassword = await bcrypt.hash('Admin@2024!', 12);
      await prisma.user.create({
        data: {
          id: 'admin-root',
          firstName: 'Admin',
          lastName: 'VisioNode',
          password: hashedPassword,
          email: adminEmail,
          role: 'admin',
          approved: true,
        }
      });
      console.log(`✅ [AUTH_STORE] [SUCCESS] [${ts}] Compte admin-root initialisé.`);
    }
  } catch (e: any) {
    console.warn(`⚠️ [AUTH_STORE] [BYPASS] [${ts}] Seeding ignoré : ${e.message}`);
  }
}

export async function authenticateUser(email: string, password: string) {
  const ts = new Date().toLocaleTimeString();
  console.log(`🔍 [AUTH_STORE] [INIT] [${ts}] Recherche : ${email}`);
  
  await ensureAdminSeeded();

  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      console.warn(`❌ [AUTH_STORE] [REJECT] [${ts}] Utilisateur inconnu.`);
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.warn(`❌ [AUTH_STORE] [REJECT] [${ts}] Mot de passe invalide.`);
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    if (!user.approved && user.role !== 'admin') {
      console.warn(`❌ [AUTH_STORE] [REJECT] [${ts}] Accès non approuvé.`);
      return { success: false, error: 'NOT_APPROVED' };
    }

    console.log(`✅ [AUTH_STORE] [SUCCESS] [${ts}] Utilisateur validé : ${user.id}`);
    return { 
      success: true, 
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role as UserRole,
        approved: user.approved,
        createdAt: user.createdAt.getTime()
      }
    };
  } catch (e: any) {
    console.error(`❌ [AUTH_STORE] [ERROR] [${ts}] Échec liaison Neon :`, e.message);
    return { success: false, error: 'DB_ERROR' };
  }
}

export async function addPendingUser(firstName: string, lastName: string, password: string, role: string) {
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@visionode.local`;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return null;

  const hashedPassword = await bcrypt.hash(password, 12);
  return await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role,
      approved: false,
    }
  });
}

export async function listPendingUsers() {
  return await prisma.user.findMany({
    where: { approved: false },
    orderBy: { createdAt: 'desc' }
  });
}

export async function approveUser(userId: string) {
  return await prisma.user.update({
    where: { id: userId },
    data: { approved: true }
  });
}

export async function rejectUser(userId: string) {
  return await prisma.user.delete({
    where: { id: userId }
  });
}

export async function getAllUsers() {
  return await prisma.user.findMany({
    orderBy: { createdAt: 'desc' }
  });
}
