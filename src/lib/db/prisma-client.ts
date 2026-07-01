import { PrismaClient } from '@prisma/client';

/**
 * @fileOverview Client Prisma Singleton pour VisioNode.
 * Assure la persistance Neon PostgreSQL avec une gestion de cache en développement.
 */

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
