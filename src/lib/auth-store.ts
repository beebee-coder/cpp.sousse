import { prisma } from '@/lib/db/prisma-client';
import bcrypt from 'bcryptjs';
import { authAudit } from './auth-audit';

/**
 * Magasin d'identités consolidé [AUTH_STORE] pour VisioNode.
 * Version 8.1.0 : Traçabilité industrielle et gestion robuste des erreurs.
 */

export async function authenticateUser(email: string, password: string) {
  const ts = new Date().toLocaleTimeString();
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user) {
      authAudit.warn('AUTH_REJECT_UNKNOWN_USER', { email: normalizedEmail });
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    if (!user.password) {
      authAudit.warn('AUTH_REJECT_NO_PASSWORD', { userId: user.id });
      return { success: false, error: 'OAUTH_ACCOUNT' };
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      authAudit.warn('AUTH_REJECT_BAD_PASSWORD', { userId: user.id });
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    if (!user.approved && user.role !== 'admin') {
      authAudit.warn('AUTH_REJECT_NOT_APPROVED', { userId: user.id });
      return { success: false, error: 'NOT_APPROVED' };
    }

    authAudit.success('AUTH_VALIDATED', { userId: user.id, role: user.role });
    
    return { 
      success: true, 
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        approved: user.approved,
        createdAt: user.createdAt.getTime()
      }
    };
  } catch (e: any) {
    authAudit.error('AUTH_DB_FATAL', { error: e.message, email: normalizedEmail });
    throw new Error(`DB_LIAISON_ECHEC: ${e.message}`);
  }
}

export async function addPendingUser(firstName: string, lastName: string, password: string, role: string) {
  try {
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@visionode.local`;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return null;

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role: role || 'user',
        approved: role === 'admin',
      }
    });

    authAudit.info('AUTH_PENDING_CREATED', { email, role });
    return user;
  } catch (e: any) {
    authAudit.error('AUTH_REGISTER_ERROR', { error: e.message });
    return null;
  }
}

export async function listPendingUsers() {
  return await prisma.user.findMany({ where: { approved: false }, orderBy: { createdAt: 'desc' } });
}

export async function approveUser(userId: string) {
  return await prisma.user.update({ where: { id: userId }, data: { approved: true } });
}

export async function rejectUser(userId: string) {
  await prisma.user.delete({ where: { id: userId } });
  return true;
}

export async function getAllUsers() {
  return await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
}
