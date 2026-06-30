
import { prisma } from './db/prisma-client';
import bcrypt from 'bcryptjs';
import type { AuthUser, UserRole } from '@/lib/auth-users';
import { authAudit } from '@/lib/auth-audit';

const normalizeName = (value: string) => value.trim().toLowerCase();

/**
 * Assure que l'administrateur système existe de manière sécurisée sans bloquer le boot.
 */
async function ensureAdminSeeded() {
  const adminEmail = 'admin@visionode.local';
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD || 'Admin@2024!';

  try {
    // Vérifier d'abord si la table user existe en tentant un count simple
    const userCount = await prisma.user.count().catch(() => -1);
    if (userCount === -1) {
      console.warn('[AUTH_SEED] Table "users" non trouvée. Le schéma doit être appliqué.');
      return;
    }

    const admin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (!admin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
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
      authAudit.info('ADMIN_AUTO_CREATED');
    }
  } catch (error: any) {
    console.warn('[AUTH_SEED] Background seeding skip:', error.message);
  }
}

function mapToAuthUser(u: any): AuthUser {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    password: u.password,
    role: u.role as UserRole,
    approved: u.approved,
    createdAt: u.createdAt instanceof Date ? u.createdAt.getTime() : Date.now(),
  };
}

export type AuthResult = {
  success: boolean;
  user?: AuthUser;
  error?: 'INVALID_CREDENTIALS' | 'NOT_APPROVED' | 'DB_ERROR';
};

export async function authenticateUser(email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = email.toLowerCase();
  
  // Tenter le seeding en arrière-plan sans bloquer la requête
  ensureAdminSeeded().catch(() => {});

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      authAudit.warn('SIGNIN_FAILED_USER_NOT_FOUND', { email: normalizedEmail });
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      authAudit.warn('SIGNIN_FAILED_WRONG_PASSWORD', { email: normalizedEmail });
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    // Protection admin root ou règle d'approbation
    const isAdmin = normalizedEmail === 'admin@visionode.local' || user.role === 'admin';

    if (!user.approved && !isAdmin) {
      authAudit.warn('SIGNIN_FAILED_NOT_APPROVED', { userId: user.id, email: normalizedEmail });
      return { success: false, error: 'NOT_APPROVED' };
    }

    return { success: true, user: mapToAuthUser(user) };
  } catch (error: any) {
    authAudit.error('AUTH_STORE_DB_ERROR', { error: error.message });
    return { success: false, error: 'DB_ERROR' };
  }
}

export async function addPendingUser(firstName: string, lastName: string, password: string, role?: string) {
  const normalizedFirst = normalizeName(firstName);
  const normalizedLast = normalizeName(lastName);
  const roleValue = String(role ?? 'user').trim().toLowerCase();
  const email = `${normalizedFirst}.${normalizedLast}@visionode.local`;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return null;

    const hashedPassword = await bcrypt.hash(password.trim(), 12);
    const newUser = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password: hashedPassword,
        email,
        role: roleValue as any,
        approved: false,
      }
    });

    return mapToAuthUser(newUser);
  } catch (error) {
    return null;
  }
}

export async function listPendingUsers() {
  try {
    const users = await prisma.user.findMany({ where: { approved: false } });
    return users.map(mapToAuthUser);
  } catch {
    return [];
  }
}

export async function approveUser(userId: string) {
  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { approved: true }
    });
    return mapToAuthUser(updated);
  } catch {
    return null;
  }
}

export async function rejectUser(userId: string) {
  try {
    await prisma.user.delete({ where: { id: userId } });
    return true;
  } catch {
    return null;
  }
}

export async function getAllUsers() {
  try {
    const users = await prisma.user.findMany();
    return users.map(mapToAuthUser);
  } catch {
    return [];
  }
}
