import { prisma } from './db/prisma-client';
import bcrypt from 'bcryptjs';

/**
 * Magasin d'identités consolidé [AUTH_STORE] pour VisioNode.
 * Version : 7.8.5 - Traçabilité industrielle complète.
 */

export async function authenticateUser(email: string, password: string) {
  const ts = new Date().toLocaleTimeString();
  console.log(`📡 [AUTH_STORE] [INIT] [${ts}] Vérification des accès pour : ${email}`);

  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      console.warn(`📡 [AUTH_STORE] [REJECT] [${ts}] Utilisateur inconnu : ${email}`);
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    console.log(`📡 [AUTH_STORE] [STEP] [${ts}] Utilisateur trouvé. Vérification de la clé de sécurité...`);
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.warn(`📡 [AUTH_STORE] [REJECT] [${ts}] Échec de la clé de sécurité.`);
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    if (!user.approved && user.role !== 'admin') {
      console.warn(`📡 [AUTH_STORE] [REJECT] [${ts}] Compte en attente d'approbation : ${user.id}`);
      return { success: false, error: 'NOT_APPROVED' };
    }

    console.log(`📡 [AUTH_STORE] [SUCCESS] [${ts}] Authentification validée pour : ${user.firstName} ${user.lastName}`);
    return { 
      success: true, 
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        approved: user.approved,
        createdAt: user.createdAt.getTime()
      }
    };
  } catch (e: any) {
    console.error(`❌ [AUTH_STORE] [FATAL] [${ts}] Panique DB :`, e.message);
    throw new Error(`DB_LIAISON_ECHEC: ${e.message}`);
  }
}

export async function addPendingUser(firstName: string, lastName: string, password: string, role: string) {
  const ts = new Date().toLocaleTimeString();
  console.log(`📡 [AUTH_STORE] [INIT] Création demande d'accès : ${firstName} ${lastName}`);

  try {
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
        approved: role === 'admin',
      }
    });
  } catch (e: any) {
    console.error(`❌ [AUTH_STORE] [ERROR] addPendingUser :`, e.message);
    return null;
  }
}

export async function listPendingUsers() {
  try {
    return await prisma.user.findMany({
      where: { approved: false },
      orderBy: { createdAt: 'desc' }
    });
  } catch { return []; }
}

export async function approveUser(userId: string) {
  try {
    return await prisma.user.update({
      where: { id: userId },
      data: { approved: true }
    });
  } catch { return null; }
}

export async function rejectUser(userId: string) {
  try {
    await prisma.user.delete({ where: { id: userId } });
    return true;
  } catch { return false; }
}

export async function getAllUsers() {
  try {
    return await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
  } catch { return []; }
}
