import { PrismaClient } from '@prisma/client';

/**
 * @fileOverview Initialisation centralisée du client Prisma.
 * Version : Singleton résilient optimisé pour Next.js (App Router).
 */

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
