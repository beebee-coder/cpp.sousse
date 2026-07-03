// src/lib/db/prisma-client.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Singleton Prisma Client pour VisioNode.
 * Adapté pour Prisma 7.8.0 sans propriété 'url' statique dans le schéma.
 */
function createPrismaClient(): PrismaClient {
  const isDev = process.env.NODE_ENV === 'development';
  
  if (!process.env.DATABASE_URL && isDev) {
    console.warn('📡 [PRISMA] [WARN] DATABASE_URL manquante. Liaison Neon différée.');
  }

  return new PrismaClient({
    log: isDev ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
