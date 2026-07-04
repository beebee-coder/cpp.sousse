import { Role } from '@prisma/client';
import {
  addPendingUser as addPendingUserStore,
  approveUser as approveUserStore,
  rejectUser as rejectUserStore,
  authenticateUser as authenticateUserStore,
  getAllUsers as getAllUsersStore,
  listPendingUsers as listPendingUsersStore,
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

export function canAccessRoute(role: Role | undefined, pathname: string) {
  if (!role) {
    return false;
  }

  const normalizedPath = pathname === '/' ? '/dashboard' : pathname;

  if (role === Role.admin) {
    return true;
  }

  const allowedRoutes: Record<Role, string[]> = {
    [Role.admin]: ['/dashboard', '/chat', '/dataset', '/bank', '/conference', '/download', '/users', '/settings'],
    [Role.chef_de_bloc]: ['/dashboard', '/chat', '/dataset', '/bank', '/conference', '/download'],
    [Role.chef_de_quart]: ['/dashboard', '/chat', '/dataset', '/bank', '/conference', '/download'],
    [Role.user]: ['/chat', '/dataset'],
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
      return '/chat';
    default:
      return '/auth/signin';
  }
}
