import { PrismaClient } from '@prisma/client';
import { neonConfig, Pool } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';

/**
 * Initialisation ultra-robuste du client Prisma pour Neon.
 * Optimisée pour éviter les crashs au démarrage si DATABASE_URL est instable.
 */

const connectionString = process.env.DATABASE_URL || '';
const isCloud = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

// Configuration Neon (uniquement si URL présente)
if (connectionString) {
  if (isCloud) {
    neonConfig.poolQueryViaFetch = true;
  }
}

const createPrismaClient = () => {
  if (!connectionString) {
    console.warn("⚠️ [PRISMA] DATABASE_URL absente. Mode dégradé activé.");
    return new PrismaClient();
  }

  try {
    // En mode développement/studio, on privilégie une connexion directe plus stable
    if (!isCloud) {
      return new PrismaClient({
        datasources: {
          db: {
            url: connectionString,
          },
        },
      });
    }

    // En mode cloud, on utilise l'adaptateur optimisé Neon
    const pool = new Pool({ connectionString });
    const adapter = new PrismaNeon(pool);
    return new PrismaClient({ adapter });
  } catch (err: any) {
    console.error("❌ [PRISMA] Échec initialisation client :", err.message);
    return new PrismaClient();
  }
};

const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
