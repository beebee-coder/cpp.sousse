import { promises as fs } from 'fs';
import path from 'path';
import type { AuthUser, UserRole } from '@/lib/auth-users';

const normalizeName = (value: string) => value.trim().toLowerCase();

const storageDir = path.join(process.cwd(), '.data');
const storagePath = path.join(storageDir, 'auth-users.json');

const buildAdminUser = (): AuthUser => {
  const adminFirstName = process.env.AUTH_ADMIN_FIRST_NAME ?? 'ahmed';
  const adminLastName = process.env.AUTH_ADMIN_LAST_NAME ?? 'abbes';
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD ?? '66023';

  return {
    id: 'admin',
    firstName: adminFirstName,
    lastName: adminLastName,
    password: adminPassword,
    role: 'admin',
    approved: true,
    createdAt: Date.now(),
  };
};

async function ensureStoreFile() {
  await fs.mkdir(storageDir, { recursive: true });

  try {
    await fs.access(storagePath);
  } catch {
    await fs.writeFile(storagePath, JSON.stringify([buildAdminUser()], null, 2), 'utf8');
  }
}

async function readUsers(): Promise<AuthUser[]> {
  await ensureStoreFile();

  const content = await fs.readFile(storagePath, 'utf8');
  const parsed = JSON.parse(content) as AuthUser[];

  const users = Array.isArray(parsed) ? parsed : [];
  const admin = users.find((user) => user.id === 'admin');
  const baseUsers = users.filter((user) => user.id !== 'admin');

  const seededUsers = [admin ?? buildAdminUser(), ...baseUsers];
  await writeUsers(seededUsers);
  return seededUsers;
}

async function writeUsers(users: AuthUser[]) {
  await ensureStoreFile();
  await fs.writeFile(storagePath, JSON.stringify(users, null, 2), 'utf8');
}

export async function authenticateUser(firstName: string, lastName: string, password: string, role?: string) {
  const normalizedFirst = normalizeName(firstName);
  const normalizedLast = normalizeName(lastName);
  const normalizedPassword = password.trim();
  const normalizedRole = role?.trim().toLowerCase();

  const users = await readUsers();

  return (
    users.find(
      (user) =>
        normalizeName(user.firstName) === normalizedFirst &&
        normalizeName(user.lastName) === normalizedLast &&
        user.password === normalizedPassword &&
        user.approved &&
        (!normalizedRole || user.role === normalizedRole),
    ) ?? null
  );
}

export async function addPendingUser(firstName: string, lastName: string, password: string, role?: string) {
  const users = await readUsers();
  const normalizedFirst = normalizeName(firstName);
  const normalizedLast = normalizeName(lastName);
  const normalizedRole = String(role ?? 'user').trim().toLowerCase();

  const existing = users.find(
    (user) => normalizeName(user.firstName) === normalizedFirst && normalizeName(user.lastName) === normalizedLast,
  );

  if (existing) {
    return null;
  }

  const roleValue = ['admin', 'chef-de-bloc', 'chef-de-quart', 'user'].includes(normalizedRole)
    ? (normalizedRole as AuthUser['role'])
    : 'user';

  const newUser: AuthUser = {
    id: `user-${Date.now()}`,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    password: password.trim(),
    role: roleValue,
    approved: false,
    createdAt: Date.now(),
  };

  const nextUsers = [...users, newUser];
  await writeUsers(nextUsers);
  return newUser;
}

export async function listPendingUsers() {
  const users = await readUsers();
  return users.filter((user) => !user.approved);
}

export async function approveUser(userId: string) {
  const users = await readUsers();
  const target = users.find((user) => user.id === userId);

  if (!target) {
    return null;
  }

  target.approved = true;
  await writeUsers(users);
  return target;
}

export async function rejectUser(userId: string) {
  const users = await readUsers();
  const filtered = users.filter((user) => user.id !== userId);
  
  if (filtered.length === users.length) {
    return null;
  }

  await writeUsers(filtered);
  return true;
}

export async function getAllUsers() {
  return readUsers();
}

export async function getUserRole(userId: string): Promise<UserRole | null> {
  const users = await readUsers();
  return users.find((user) => user.id === userId)?.role ?? null;
}
