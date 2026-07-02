// src/lib/db/prisma-client.ts
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool } from '@neondatabase/serverless';

/**
 * @fileOverview Singleton Prisma optimisé pour Prisma 7.8.0 et Neon.
 * Version : Liaison dynamique via pool serverless (P1012-safe).
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL || '';
  
  if (!connectionString) {
    console.warn("⚠️ [DATABASE] DATABASE_URL manquante. Le client Prisma s'initialisera en mode dégradé.");
  }

  // Configuration Neon Serverless Adapter pour Prisma 7
  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Diagnostic de connexion Neon.
 */
export async function checkDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (e: any) {
    console.error("❌ [DATABASE_LIAISON_ERROR] :", e.message);
    return false;
  }
}
