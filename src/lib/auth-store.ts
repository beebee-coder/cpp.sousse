
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
    const userCount = await prisma.user.count().catch(() => -1);
    if (userCount === -1) {
      console.warn('[AUTH_STORE] [ERROR] Table "users" non trouvée. Schéma SQL manquant.');
      return;
    }

    const admin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (!admin) {
      console.log(`[AUTH_STORE] [STEP] Création automatique de l'administrateur système...`);
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
      console.log(`[AUTH_STORE] [SUCCESS] Compte admin-root initialisé.`);
    }
  } catch (error: any) {
    console.warn('[AUTH_STORE] [BYPASS] Background seeding ignoré:', error.message);
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
  console.log(`[AUTH_STORE] [INIT] Tentative de vérification pour : ${normalizedEmail}`);
  
  await ensureAdminSeeded().catch(() => {});

  try {
    console.log(`[AUTH_STORE] [STEP] Recherche utilisateur dans Neon SQL...`);
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      console.warn(`[AUTH_STORE] [REJECT] Utilisateur inconnu : ${normalizedEmail}`);
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    console.log(`[AUTH_STORE] [STEP] Vérification du hash password...`);
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      console.warn(`[AUTH_STORE] [REJECT] Mot de passe incorrect pour : ${normalizedEmail}`);
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    if (!user.approved && user.role !== 'admin') {
      console.warn(`[AUTH_STORE] [REJECT] Compte non approuvé : ${user.id}`);
      return { success: false, error: 'NOT_APPROVED' };
    }

    console.log(`[AUTH_STORE] [SUCCESS] Accréditation confirmée pour : ${user.id} (${user.role})`);
    return { success: true, user: mapToAuthUser(user) };
  } catch (error: any) {
    console.error(`[AUTH_STORE] [ERROR] Échec liaison Neon :`, error.message);
    return { success: false, error: 'DB_ERROR' };
  }
}

export async function addPendingUser(firstName: string, lastName: string, password: string, role?: string) {
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@visionode.local`;
  console.log(`[AUTH_STORE] [INIT] Enregistrement d'une demande d'accès : ${email}`);

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.warn(`[AUTH_STORE] [REJECT] Demande existante ou doublon : ${email}`);
      return null;
    }

    const hashedPassword = await bcrypt.hash(password.trim(), 12);
    const newUser = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password: hashedPassword,
        email,
        role: (role || 'user') as any,
        approved: false,
      }
    });

    console.log(`[AUTH_STORE] [SUCCESS] Demande sauvegardée : ${newUser.id}`);
    return mapToAuthUser(newUser);
  } catch (error: any) {
    console.error(`[AUTH_STORE] [ERROR] Échec création demande :`, error.message);
    return null;
  }
}

export async function listPendingUsers() {
  try {
    return (await prisma.user.findMany({ where: { approved: false } })).map(mapToAuthUser);
  } catch {
    return [];
  }
}

export async function approveUser(userId: string) {
  try {
    console.log(`[AUTH_STORE] [STEP] Approbation utilisateur : ${userId}`);
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { approved: true }
    });
    console.log(`[AUTH_STORE] [SUCCESS] Utilisateur approuvé.`);
    return mapToAuthUser(updated);
  } catch {
    return null;
  }
}

export async function rejectUser(userId: string) {
  try {
    console.log(`[AUTH_STORE] [STEP] Rejet et suppression utilisateur : ${userId}`);
    await prisma.user.delete({ where: { id: userId } });
    console.log(`[AUTH_STORE] [SUCCESS] Dossier utilisateur purgé.`);
    return true;
  } catch {
    return null;
  }
}

export async function getAllUsers() {
  try {
    return (await prisma.user.findMany()).map(mapToAuthUser);
  } catch {
    return [];
  }
}
