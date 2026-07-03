// src/lib/db/prisma-client.ts
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as dotenv from 'dotenv';

// Charger l'environnement si nécessaire (indispensable pour les scripts hors Next.js comme le seed)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

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
    console.warn('⚠️ [Prisma] DATABASE_URL non définie. Liaison Neon suspendue ou mode local actif.');
    return new PrismaClient();
  }

  // ✅ Utilisation de l'adaptateur Neon certifié stable v7.8.0
  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool as any);
  
  console.log('🔧 [Prisma] Liaison Neon établie via adaptateur natif stable.');

  return new PrismaClient({ adapter: adapter as any });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
