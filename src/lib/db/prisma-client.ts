
import { PrismaClient } from '@prisma/client';

/**
 * @fileOverview Initialisation ultra-robuste du client Prisma.
 * Gère les environnements où la DATABASE_URL peut être absente ou instable.
 */

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const createPrismaClient = () => {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.warn('⚠️ [PRISMA] DATABASE_URL est absente. Les fonctionnalités DB seront désactivées.');
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });
};

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
