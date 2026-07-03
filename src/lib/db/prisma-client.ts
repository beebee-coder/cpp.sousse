// src/lib/db/prisma-client.ts
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// ✅ Configuration Neon pour Prisma 7.8.0 (Latest)
if (typeof window === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL is not defined');
    }
    console.warn('⚠️ [Prisma] DATABASE_URL non définie. Liaison Neon suspendue.');
    return new PrismaClient();
  }

  // ✅ Utilisation de l'adaptateur Neon certifié stable
  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);
  
  console.log('🔧 [Prisma] Liaison Neon établie via adaptateur natif v7.8.0.');

  return new PrismaClient({ adapter: adapter as any });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;