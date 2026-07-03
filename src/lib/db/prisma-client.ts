
// src/lib/db/prisma-client.ts - Stable Prisma 5.22.0
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

if (typeof window === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const ts = new Date().toLocaleTimeString();
  const connectionString = (process.env.DATABASE_URL || '').replace(/^"|"$/g, '').trim();

  if (!connectionString) {
    console.warn(`⚠️ [${ts}] [Prisma] DATABASE_URL absente. Liaison de secours.`);
    return new PrismaClient();
  }

  try {
    console.log(`📡 [${ts}] [Prisma] Initialisation Adaptateur Neon V5 (Stable).`);
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
