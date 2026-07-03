// src/lib/db/prisma-client.ts
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Charger l'environnement avant toute instanciation (Crucial pour Prisma 7)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

if (typeof window === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const ts = new Date().toLocaleTimeString();
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    console.warn(`⚠️ [${ts}] [Prisma] DATABASE_URL absente. Liaison simulée.`);
    return new PrismaClient();
  }

  // Nettoyage rigoureux de la chaîne (enlève guillemets et espaces)
  const connectionString = rawUrl.replace(/^"|"$/g, '').trim();

  try {
    console.log(`📡 [${ts}] [Prisma] Initialisation Adaptateur Neon WASM.`);
    
    // On passe explicitement la chaîne au constructeur Pool pour éviter l'erreur "No database host"
    const pool = new Pool({ connectionString });
    const adapter = new PrismaNeon(pool);
    
    // @ts-ignore - Prisma 7 supporte la propriété adapter nativement
    return new PrismaClient({ adapter });
  } catch (err: any) {
    console.error(`❌ [${ts}] [Prisma] Échec Liaison :`, err.message);
    return new PrismaClient();
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
