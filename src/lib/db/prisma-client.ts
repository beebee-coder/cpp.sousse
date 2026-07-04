
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// ✅ Configuration WebSocket Neon pour environnement Node
if (typeof window === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Singleton Prisma 5.22.0 stabilisé pour Neon.
 */
function createPrismaClient(): PrismaClient {
  const ts = new Date().toLocaleTimeString();
  const connectionString = (process.env.DATABASE_URL || '').replace(/^"|"$/g, '').trim();

  if (!connectionString) {
    console.warn(`⚠️ [${ts}] [Prisma] DATABASE_URL absente.`);
    return new PrismaClient();
  }

  try {
    console.log(`📡 [${ts}] [Prisma] Liaison Neon via Adaptateur WASM.`);
    const pool = new Pool({ connectionString });
    const adapter = new PrismaNeon(pool);
    return new PrismaClient({ adapter });
  } catch (err: any) {
    console.error(`❌ [${ts}] [Prisma] Échec Liaison :`, err.message);
    return new PrismaClient();
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
