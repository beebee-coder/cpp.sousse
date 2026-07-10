import { Role } from '@prisma/client';
import {
  addPendingUser as addPendingUserStore,
  approveUser as approveUserStore,
  rejectUser as rejectUserStore,
  authenticateUser as authenticateUserStore,
  getAllUsers as getAllUsersStore,
  getUserById as getUserByIdStore,
  listPendingUsers as listPendingUsersStore,
  updateCurrentUser as updateCurrentUserStore,
  verifyUserPassword as verifyUserPasswordStore,
} from '@/lib/auth-store';

// Ré-exporter le type Role depuis Prisma pour assurer la cohérence
export type UserRole = Role;

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Role;
  approved: boolean;
  createdAt: number;
}

export async function authenticateUser(email: string, password: string) {
  return authenticateUserStore(email, password);
}

export async function addPendingUser(firstName: string, lastName: string, password: string, role: Role = Role.user) {
  return addPendingUserStore(firstName, lastName, password, role);
}

export async function listPendingUsers() {
  return listPendingUsersStore();
}

export async function approveUser(userId: string) {
  return approveUserStore(userId);
}

export async function rejectUser(userId: string) {
  return rejectUserStore(userId);
}

export async function getAllUsers() {
  return getAllUsersStore();
}

export async function getUserById(userId: string) {
  return getUserByIdStore(userId);
}

export async function verifyUserPassword(userId: string, password: string) {
  return verifyUserPasswordStore(userId, password);
}

export async function updateCurrentUser(
  userId: string,
  data: { firstName?: string; lastName?: string; email?: string; password?: string }
) {
  return updateCurrentUserStore(userId, data);
}

export function canAccessRoute(role: Role | undefined, pathname: string) {
  if (!role) {
    return false;
  }

  const normalizedPath = pathname === '/' ? '/dashboard' : pathname;

  if (role === Role.admin) {
    return true;
  }

  const allowedRoutes: Record<Role, string[]> = {
    [Role.admin]: ['/dashboard', '/dataset', '/bank', '/conference', '/download', '/users', '/settings'],
    [Role.chef_de_bloc]: ['/dashboard', '/dataset', '/bank', '/conference', '/download'],
    [Role.chef_de_quart]: ['/dashboard', '/dataset', '/bank', '/conference', '/download'],
    [Role.user]: ['/dataset'],
  };

  return allowedRoutes[role]?.includes(normalizedPath) ?? false;
}

export function getHomePath(role: Role | undefined) {
  switch (role) {
    case Role.admin:
    case Role.chef_de_bloc:
    case Role.chef_de_quart:
      return '/dashboard';
    case Role.user:
      return '/dataset';
    default:
      return '/auth/signin';
  }
}
