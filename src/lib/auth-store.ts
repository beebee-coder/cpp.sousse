import { prisma } from './db/prisma-client';
import bcrypt from 'bcryptjs';

/**
 * Magasin d'identités consolidé [AUTH_STORE] pour VisioNode.
 * Version : 7.8.1 - Support complet des fonctions administratives.
 */

export async function authenticateUser(email: string, password: string) {
  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return { success: false, error: 'INVALID_CREDENTIALS' };

    const match = await bcrypt.compare(password, user.password);
    if (!match) return { success: false, error: 'INVALID_CREDENTIALS' };

    if (!user.approved && user.role !== 'admin') {
      return { success: false, error: 'NOT_APPROVED' };
    }

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
    console.error(`❌ [AUTH_STORE] [ERROR] :`, e.message);
    throw new Error(`DB_LIAISON_ECHEC: ${e.message}`);
  }
}

export async function addPendingUser(firstName: string, lastName: string, password: string, role: string) {
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
    console.error(`❌ [AUTH_STORE] addPendingUser :`, e.message);
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
