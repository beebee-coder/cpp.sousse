import { PrismaClient } from '../../generated/prisma';
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

// Configuration de WebSocket requise pour les environnements serverless / edge (Vercel) ou contournement firewall local
if (typeof window === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("La variable d'environnement DATABASE_URL est manquante.");
  }
  
  // L'adaptateur instanciera son propre Pool en interne.
  // neonConfig garantit qu'il utilisera le WebSocket.
  const adapter = new PrismaNeon({ connectionString });
  
  return new PrismaClient({
    adapter,
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

