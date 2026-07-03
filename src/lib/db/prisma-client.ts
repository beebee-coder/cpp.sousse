// src/lib/db/prisma-client.ts
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

/**
 * Client Prisma 7.8.0 avec adaptateur Neon stable.
 * Version : Injection Explicite (Résout l'erreur No database host).
 */

if (typeof window === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    console.warn('⚠️ [Prisma] DATABASE_URL absente. Liaison locale simulée.');
    return new PrismaClient();
  }

  // Nettoyage strict de la chaîne de connexion
  const connectionString = rawUrl.replace(/^"|"$/g, '');

  try {
    // Injection explicite du host et de la chaîne pour l'adaptateur Neon
    const pool = new Pool({ connectionString });
    const adapter = new PrismaNeon(pool);
    
    // @ts-ignore - Prisma 7 supporte la propriété adapter
    return new PrismaClient({ adapter });
  } catch (err: any) {
    console.error('❌ [Prisma] Échec adaptateur Neon :', err.message);
    return new PrismaClient();
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
