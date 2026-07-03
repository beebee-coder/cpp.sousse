// src/lib/db/prisma-client.ts
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool } from '@neondatabase/serverless';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Singleton Prisma Client pour VisioNode.
 * Stable pour Prisma 5.22.0 avec adaptateur Neon.
 */
function createPrismaClient(): PrismaClient {
  const isDev = process.env.NODE_ENV === 'development';
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    if (isDev) {
      console.warn('📡 [PRISMA] [WARN] DATABASE_URL manquante. Connexion différée.');
      return new PrismaClient();
    }
    throw new Error('DATABASE_URL is not defined');
  }

  // Configuration Neon pour environnement Serverless (Edge compatible)
  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);

  return new PrismaClient({
    adapter,
    log: isDev ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;