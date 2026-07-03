// src/lib/db/prisma-client.ts
import { PrismaClient } from '@prisma/client';

// ============================================================
// 📦 CLIENT PRISMA - VERSION PRISMA 7
// ============================================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// ✅ Création SIMPLE du client Prisma 7
function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  
  if (!url) {
    console.error('❌ [PRISMA] Erreur Critique : DATABASE_URL non définie dans l\'environnement.');
    // En développement, on ne throw pas immédiatement pour permettre au build de passer
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL is not defined in production');
    }
  }

  console.log('🔧 [PRISMA] Initialisation du client industriel...');
  
  // ✅ PRISMA 7 : Le client utilise la config pilotée par prisma.config.ts ou env
  return new PrismaClient();
}

// Singleton
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;

// Fonction de déconnexion
export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
  }
}