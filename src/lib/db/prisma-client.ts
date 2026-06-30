import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';

const connectionString = process.env.DATABASE_URL || '';

let poolConfig: any = { connectionString };

// Détecter si l'application s'exécute en local ou sur Vercel
const isLocal = !process.env.VERCEL;

if (isLocal) {
  // ✅ Configurer WebSocket pour contourner les pare-feux locaux
  try {
    const ws = require('ws');
    neonConfig.webSocketConstructor = ws;
    neonConfig.poolQueryViaFetch = false;
  } catch (e) {
    console.warn("[PRISMA] Module 'ws' non trouvé, tentative via fetch standard.");
  }

  // Parser la chaîne de connexion pour contourner les erreurs internes du driver
  try {
    if (connectionString && (connectionString.startsWith('postgres') || connectionString.startsWith('postgresql'))) {
      const url = new URL(connectionString);
      poolConfig = {
        host: url.hostname,
        user: url.username,
        password: url.password,
        database: url.pathname.replace(/^\//, ''),
        port: parseInt(url.port || '5432'),
        ssl: true,
      };
    } else {
      console.warn("⚠️ [PRISMA] DATABASE_URL absente ou format invalide.");
    }
  } catch (e) {
    console.error("DEBUG: Failed to parse DATABASE_URL", e);
  }
} else {
  // Sur Vercel, utiliser les requêtes HTTP (fetch) beaucoup plus adaptées et rapides en serverless
  neonConfig.poolQueryViaFetch = true;
}

/**
 * Création sécurisée de l'instance Prisma.
 * Si DATABASE_URL est absente, on évite le crash au boot.
 */
let prismaInstance: PrismaClient;

try {
  const adapter = new PrismaNeon(poolConfig);
  prismaInstance = new PrismaClient({ adapter });
} catch (err) {
  console.error("❌ [PRISMA] Impossible d'initialiser l'adapter Neon.");
  prismaInstance = new PrismaClient(); // Fallback vers driver standard
}

export const prisma = prismaInstance;
export default prisma;
