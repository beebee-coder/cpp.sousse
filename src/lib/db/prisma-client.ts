import { PrismaClient } from '@prisma/client';
import { neonConfig, Pool } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

/**
 * Initialisation sécurisée du client Prisma pour Neon.
 * Supporte le mode Serverless (HTTP) et Local (WebSocket).
 */

const connectionString = process.env.DATABASE_URL || '';
const isCloud = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

// Configuration globale Neon
if (!isCloud) {
  // Nécessaire pour les connexions persistantes en local (Dev/Desktop)
  neonConfig.webSocketConstructor = ws;
} else {
  // Optimisation pour Vercel Edge/Serverless
  neonConfig.poolQueryViaFetch = true;
}

const createPrismaClient = () => {
  console.log(`[PRISMA] 🛰️ Initialisation du client (Mode: ${isCloud ? 'Cloud' : 'Local'})`);
  
  if (!connectionString) {
    console.warn("⚠️ [PRISMA] DATABASE_URL manquante. Le client démarrera en mode dégradé.");
    return new PrismaClient();
  }

  try {
    const pool = new Pool({ connectionString });
    const adapter = new PrismaNeon(pool);
    return new PrismaClient({ adapter });
  } catch (err: any) {
    console.error("❌ [PRISMA] Erreur fatale d'initialisation :", err.message);
    // Retourne un client standard pour éviter le crash au chargement du module
    return new PrismaClient();
  }
};

// Singleton pattern pour Next.js (Fast Refresh safe)
const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
