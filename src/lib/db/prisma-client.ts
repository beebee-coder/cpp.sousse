import { PrismaClient } from '@prisma/client';
import { neonConfig, Pool } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

// Configuration Neon pour supporter les environnements hybrides (Vercel + Local)
const connectionString = process.env.DATABASE_URL || '';

/**
 * Initialisation intelligente du client Prisma.
 * Sur Vercel (Production) : Utilise fetch (HTTP) pour la performance serverless.
 * En Local (Dev/Desktop) : Utilise WebSockets pour supporter les connexions persistantes.
 */
const isCloud = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

if (!isCloud) {
  // Configuration WebSocket pour le développement local
  neonConfig.webSocketConstructor = ws;
} else {
  // Optimisation HTTP pour Vercel
  neonConfig.poolQueryViaFetch = true;
}

const createPrismaClient = () => {
  if (!connectionString) {
    console.warn("⚠️ [PRISMA] DATABASE_URL non définie. Le système fonctionnera en mode dégradé.");
    return new PrismaClient();
  }

  try {
    const pool = new Pool({ connectionString });
    const adapter = new PrismaNeon(pool);
    return new PrismaClient({ adapter });
  } catch (err) {
    console.error("❌ [PRISMA] Erreur d'initialisation de l'adaptateur Neon :", err);
    return new PrismaClient();
  }
};

// Singleton pour éviter de saturer les connexions en mode développement
const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
