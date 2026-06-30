import { prisma } from './db/prisma-client';
import bcrypt from 'bcryptjs';
import type { AuthUser, UserRole } from '@/lib/auth-users';
import { authAudit } from '@/lib/auth-audit';

const normalizeName = (value: string) => value.trim().toLowerCase();

/**
 * Assure que l'administrateur système existe.
 * Isolé pour ne pas faire planter la connexion si le seeding échoue.
 */
async function ensureAdminSeeded() {
  const adminEmail = 'admin@visionode.local';
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD || 'Admin@2024!';

  try {
    // Vérification légère
    const admin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (!admin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      await prisma.user.create({
        data: {
          id: 'admin-root',
          firstName: 'Ahmed',
          lastName: 'Abbes',
          password: hashedPassword,
          email: adminEmail,
          role: 'admin',
          approved: true,
        }
      });
      authAudit.info('ADMIN_AUTO_CREATED');
    }
  } catch (error: any) {
    authAudit.warn('ADMIN_SEED_FAILED', { reason: error.message });
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
  
  // Lancement du seeding asynchrone (non-bloquant)
  ensureAdminSeeded().catch(() => {});

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    // L'admin root n'a jamais besoin d'approbation
    const isAdmin = normalizedEmail === 'admin@visionode.local' || user.role === 'admin';

    if (!user.approved && !isAdmin) {
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
  const normalizedRole = String(role ?? 'user').trim().toLowerCase();
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
        role: normalizedRole as any,
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
