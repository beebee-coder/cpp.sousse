import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const ts = new Date().toLocaleTimeString();
  const rawUrl = process.env.DATABASE_URL || '';
  const connectionString = rawUrl.replace(/^"|"$/g, '').trim();

  if (!connectionString) {
    throw new Error(`DATABASE_URL manquante. Définissez-la dans le fichier .env avant de lancer l'application.`);
  }

  try {
    console.log(`📡 [${ts}] [Prisma] Liaison Adaptateur Neon V7.`);
    const adapter = new PrismaNeon({ connectionString });
    return new PrismaClient({ adapter });
  } catch (err: any) {
    console.error(`❌ [${ts}] [Prisma] Échec Initialisation :`, err.message);
    throw err;
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
