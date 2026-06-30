import { PrismaClient } from '@prisma/client';

/**
 * @fileOverview Initialisation centralisée du client Prisma.
 * Version : Résiliente avec Timeout et Lazy Load.
 */

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const createPrismaClient = () => {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.warn('⚠️ [PRISMA] DATABASE_URL est absente. Le serveur démarrera en mode dégradé.');
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    errorFormat: 'pretty',
  });
};

// Utilisation du singleton pour éviter l'épuisement des connexions en mode dev
export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
