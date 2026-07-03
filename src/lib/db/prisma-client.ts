// src/lib/db/prisma-client.ts
import { PrismaClient } from '@prisma/client';

// ✅ Configuration pour Prisma 7 avec engine WASM
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL non définie');
    throw new Error('DATABASE_URL is not defined');
  }

  console.log('🔧 [Prisma] Connexion avec engine WASM...');
  
  // ✅ Pas d'options complexes - Prisma utilise prisma.config.ts
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
