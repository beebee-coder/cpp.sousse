// src/lib/db/prisma-client.ts
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

/**
 * @fileOverview Client Prisma singleton compatible avec l'adaptateur Neon WASM.
 * Version : Stabilisation V15.0 - Détection forcée de DATABASE_URL.
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
    console.warn('⚠️ [Prisma] DATABASE_URL non trouvée. Liaison Neon désactivée.');
    return new PrismaClient();
  }

  try {
    const pool = new Pool({ connectionString });
    const adapter = new PrismaNeon(pool as any);
    
    console.log('🔧 [Prisma] Liaison Neon établie via adaptateur natif.');
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
