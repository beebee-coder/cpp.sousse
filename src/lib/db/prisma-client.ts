import { PrismaClient } from '@prisma/client';

/**
 * @fileOverview Initialisation centralisée du client Prisma.
 * Gère le singleton en développement pour éviter l'épuisement des connexions.
 */

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const createPrismaClient = () => {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.warn('⚠️ [PRISMA] DATABASE_URL est absente. Les fonctionnalités DB seront désactivées.');
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
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
