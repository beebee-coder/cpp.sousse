import { PrismaClient } from '@prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

/**
 * @fileOverview Client Prisma Singleton optimisé pour Prisma 7 et Neon.
 * Utilise l'adaptateur Neon pour supporter les environnements Edge/Cloud.
 */

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const ts = new Date().toLocaleTimeString();
  console.log(`🔌 [PRISMA_CLIENT] [INIT] [${ts}] Initialisation du pilote Neon.`);

  if (typeof window === 'undefined') {
    neonConfig.webSocketConstructor = ws;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn(`⚠️ [PRISMA_CLIENT] DATABASE_URL manquante. Mode dégradé.`);
    return new PrismaClient();
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
