// src/lib/db/prisma-client.ts
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

/**
 * @fileOverview Client Prisma singleton certifié Prisma 7 + Neon.
 * Version : Stabilisation V16.0 - Liaison adaptée aux nouveaux standards.
 */

if (typeof window === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn('⚠️ [Prisma] DATABASE_URL absente. Mode dégradé activé.');
    return new PrismaClient();
  }

  try {
    const pool = new Pool({ connectionString });
    const adapter = new PrismaNeon(pool as any);
    
    console.log('🔧 [Prisma] Liaison Neon établie (Prisma 7 Adapter).');
    return new PrismaClient({ adapter: adapter as any });
  } catch (err: any) {
    console.error('❌ [Prisma] Échec initialisation adaptateur Neon :', err.message);
    return new PrismaClient();
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
