import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

/**
 * Configuration de l'adaptateur Neon WASM pour Prisma 5.22.0.
 * Résout les erreurs de liaison WebSocket en environnement Node.
 */
if (typeof window === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const ts = new Date().toLocaleTimeString();
  const rawUrl = process.env.DATABASE_URL || '';
  const connectionString = rawUrl.replace(/^"|"$/g, '').trim();

  if (!connectionString) {
    console.warn(`⚠️ [${ts}] [Prisma] DATABASE_URL absente.`);
    return new PrismaClient();
  }

  try {
    console.log(`📡 [${ts}] [Prisma] Liaison Adaptateur Neon V5 (Stable).`);
    const pool = new Pool({ connectionString });
    const adapter = new PrismaNeon(pool);
    // @ts-ignore - Compatibilité Prisma 5/Adapter
    return new PrismaClient({ adapter });
  } catch (err: any) {
    console.error(`❌ [${ts}] [Prisma] Échec Initialisation :`, err.message);
    return new PrismaClient();
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
