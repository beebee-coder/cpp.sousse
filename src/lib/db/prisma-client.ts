import { PrismaClient } from '@prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

/**
 * @fileOverview Client Prisma Singleton optimisé pour Prisma 7 et Neon.
 * Version : 7.8.5 - Stabilisée pour l'authentification industrielle.
 */

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const ts = new Date().toLocaleTimeString();
  console.log(`🔌 [PRISMA_CLIENT] [INIT] [${ts}] Initialisation de la liaison Neon.`);

  // Configuration WebSocket pour Neon en mode serverless (obligatoire hors Edge)
  if (typeof window === 'undefined') {
    neonConfig.webSocketConstructor = ws;
  }

  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error(`❌ [PRISMA_CLIENT] [${ts}] DATABASE_URL manquante.`);
    // Fallback sans adaptateur pour permettre au moins l'initialisation du type Prisma
    return new PrismaClient();
  }

  try {
    const pool = new Pool({ connectionString });
    const adapter = new PrismaNeon(pool);

    // Prisma 7 : Injection de l'adaptateur via le constructeur
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  } catch (err: any) {
    console.error(`❌ [PRISMA_CLIENT] [FATAL] [${ts}] Échec de la liaison Neon :`, err.message);
    return new PrismaClient();
  }
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
