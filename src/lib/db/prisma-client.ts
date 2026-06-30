
import { PrismaClient } from '@prisma/client';

/**
 * @fileOverview Initialisation ultra-robuste du client Prisma.
 * Évite les crashs au démarrage si la base de données est instable.
 */

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
};

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
