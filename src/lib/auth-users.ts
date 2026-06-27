export type UserRole = 'admin' | 'chef-de-bloc' | 'chef-de-quart' | 'user';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  password: string;
  role: UserRole;
  approved: boolean;
  createdAt: number;
}

import {
  addPendingUser as addPendingUserStore,
  approveUser as approveUserStore,
  rejectUser as rejectUserStore,
  authenticateUser as authenticateUserStore,
  getAllUsers as getAllUsersStore,
  listPendingUsers as listPendingUsersStore,
} from '@/lib/auth-store';

export async function authenticateUser(firstName: string, lastName: string, password: string, role?: string) {
  return authenticateUserStore(firstName, lastName, password, role);
}

export async function addPendingUser(firstName: string, lastName: string, password: string, role: string) {
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

export function canAccessRoute(role: UserRole | undefined, pathname: string) {
  if (!role) {
    return false;
  }

  const normalizedPath = pathname === '/' ? '/dashboard' : pathname;

  if (role === 'admin') {
    return true;
  }

  const allowedRoutes: Record<string, string[]> = {
    'chef-de-bloc': ['/dashboard', '/chat', '/dataset', '/bank', '/conference', '/download'],
    'chef-de-quart': ['/dashboard', '/chat', '/dataset', '/bank', '/conference', '/download'],
    user: ['/chat', '/dataset'],
  };

  return allowedRoutes[role]?.includes(normalizedPath) ?? false;
}

export function getHomePath(role: UserRole | undefined) {
  switch (role) {
    case 'admin':
    case 'chef-de-bloc':
    case 'chef-de-quart':
      return '/dashboard';
    case 'user':
      return '/chat';
    default:
      return '/auth/signin';
  }
}
