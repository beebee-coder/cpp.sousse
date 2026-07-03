
// src/lib/db/prisma-client.ts - Version 5.22.0 (Stable)
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Charger l'environnement
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

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
    console.warn(`⚠️ [${ts}] [Prisma] DATABASE_URL absente. Liaison simulée.`);
    return new PrismaClient();
  }

  try {
    console.log(`📡 [${ts}] [Prisma] Initialisation Adaptateur Neon V5.`);
    const pool = new Pool({ connectionString });
    const adapter = new PrismaNeon(pool);
    
    return new PrismaClient({ adapter: adapter as any });
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
