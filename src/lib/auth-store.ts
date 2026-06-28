import { prisma } from './db/prisma-client';
import bcrypt from 'bcryptjs';
import type { AuthUser, UserRole } from '@/lib/auth-users';
import { authAudit } from '@/lib/auth-audit';

const normalizeName = (value: string) => value.trim().toLowerCase();

/**
 * Assure que l'utilisateur administrateur par défaut est inséré en base de données.
 */
async function ensureAdminSeeded() {
  const adminFirstName = process.env.AUTH_ADMIN_FIRST_NAME ?? 'ahmed';
  const adminLastName = process.env.AUTH_ADMIN_LAST_NAME ?? 'abbes';
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD ?? '66023';
  const adminEmail = 'admin@visionode.local';

  try {
    const admin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (!admin) {
      authAudit.info('ADMIN_SEED_START', { email: adminEmail });
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      await prisma.user.create({
        data: {
          id: 'admin',
          firstName: adminFirstName,
          lastName: adminLastName,
          password: hashedPassword,
          email: adminEmail,
          role: 'admin',
          approved: true,
        }
      });
      authAudit.success('ADMIN_SEED_DONE', { email: adminEmail });
    }
  } catch (error) {
    authAudit.error('ADMIN_SEED_ERROR', {
      email: adminEmail,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Mappe un utilisateur Prisma vers le type AuthUser attendu par l'application.
 */
function mapToAuthUser(u: any): AuthUser {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    password: u.password,
    role: u.role as UserRole,
    approved: u.approved,
    createdAt: u.createdAt.getTime(),
  };
}

export async function authenticateUser(email: string, password: string) {
  await ensureAdminSeeded();

  authAudit.info('AUTH_STORE_LOOKUP', { email });

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      authAudit.warn('AUTH_STORE_USER_NOT_FOUND', { email });
      return null;
    }

    authAudit.info('AUTH_STORE_USER_FOUND', {
      email,
      userId: user.id,
      role: user.role,
      approved: user.approved,
    });

    if (!user.approved) {
      authAudit.warn('AUTH_STORE_ACCOUNT_PENDING', { email, userId: user.id });
      return null;
    }

    authAudit.info('AUTH_STORE_BCRYPT_CHECK', { email, userId: user.id });
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      authAudit.warn('AUTH_STORE_WRONG_PASSWORD', { email, userId: user.id });
      return null;
    }

    authAudit.success('AUTH_STORE_AUTH_OK', {
      email,
      userId: user.id,
      role: user.role,
      name: `${user.firstName} ${user.lastName}`,
    });

    return mapToAuthUser(user);
  } catch (error) {
    authAudit.error('AUTH_STORE_DB_ERROR', {
      email,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function addPendingUser(firstName: string, lastName: string, password: string, role?: string) {
  await ensureAdminSeeded();
  const normalizedFirst = normalizeName(firstName);
  const normalizedLast = normalizeName(lastName);
  const normalizedRole = String(role ?? 'user').trim().toLowerCase();
  const email = `${normalizedFirst}.${normalizedLast}@visionode.local`;

  authAudit.info('REGISTER_ATTEMPT', { firstName, lastName, email, role: normalizedRole });

  try {
    const users = await prisma.user.findMany();
    const existing = users.find(
      (user) => normalizeName(user.firstName) === normalizedFirst && normalizeName(user.lastName) === normalizedLast,
    );

    if (existing) {
      authAudit.warn('REGISTER_DUPLICATE', { firstName, lastName, email });
      return null;
    }

    const roleValue = ['admin', 'chef-de-bloc', 'chef-de-quart', 'user'].includes(normalizedRole)
      ? (normalizedRole as AuthUser['role'])
      : 'user';

    const hashedPassword = await bcrypt.hash(password.trim(), 12);

    const newUser = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password: hashedPassword,
        email,
        role: roleValue,
        approved: false,
      }
    });

    authAudit.success('REGISTER_PENDING_CREATED', {
      userId: newUser.id,
      email,
      role: roleValue,
      status: 'pending_approval',
    });

    return mapToAuthUser(newUser);
  } catch (error) {
    authAudit.error('REGISTER_ERROR', {
      email,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function listPendingUsers() {
  await ensureAdminSeeded();
  try {
    const users = await prisma.user.findMany({
      where: { approved: false }
    });
    authAudit.info('ADMIN_LIST_PENDING', { count: users.length });
    return users.map(mapToAuthUser);
  } catch (error) {
    authAudit.error('ADMIN_LIST_PENDING_ERROR', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export async function approveUser(userId: string) {
  await ensureAdminSeeded();
  authAudit.info('ADMIN_APPROVE_START', { userId });
  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { approved: true }
    });
    authAudit.success('ADMIN_APPROVE_DONE', { userId, email: updated.email, role: updated.role });
    return mapToAuthUser(updated);
  } catch (error) {
    authAudit.error('ADMIN_APPROVE_ERROR', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function rejectUser(userId: string) {
  await ensureAdminSeeded();
  authAudit.info('ADMIN_REJECT_START', { userId });
  try {
    await prisma.user.delete({
      where: { id: userId }
    });
    authAudit.success('ADMIN_REJECT_DONE', { userId });
    return true;
  } catch (error) {
    authAudit.error('ADMIN_REJECT_ERROR', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function getAllUsers() {
  await ensureAdminSeeded();
  try {
    const users = await prisma.user.findMany();
    authAudit.info('ADMIN_GET_ALL_USERS', { count: users.length });
    return users.map(mapToAuthUser);
  } catch (error) {
    authAudit.error('ADMIN_GET_ALL_USERS_ERROR', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export async function getUserRole(userId: string): Promise<UserRole | null> {
  await ensureAdminSeeded();
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    return (user?.role as UserRole) ?? null;
  } catch (error) {
    authAudit.error('GET_USER_ROLE_ERROR', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
