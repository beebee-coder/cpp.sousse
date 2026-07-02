// src/lib/db/prisma-client.ts
import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma optimisé pour Next.js 15 et Prisma 7.8.0.
 * La configuration de connexion est gérée par prisma.config.ts.
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
 * Diagnostic de connexion Neon/Postgres.
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
