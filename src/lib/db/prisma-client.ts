// src/lib/db/prisma-client.ts
import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma optimisé pour Next.js 15 et Prisma 7.
 * Gère dynamiquement la connexion sans dépendre du champ 'url' dans le schéma.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Diagnostic de connexion Neon/Postgres
 */
export async function checkDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (e) {
    console.error("❌ [DATABASE_LIAISON_ERROR] :", e);
    return false;
  }
}
