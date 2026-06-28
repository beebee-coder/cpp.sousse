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
    console.error("Failed to load ws module locally", e);
  }

  // Parser la chaîne de connexion pour contourner les erreurs internes du driver et initialiser les variables PG
  try {
    if (connectionString) {
      const url = new URL(connectionString);
      const host = url.hostname;
      const user = url.username;
      const database = url.pathname.replace(/^\//, '');
      const password = url.password;
      const port = url.port || '5432';

      // Injecter dans process.env pour le driver
      process.env.PGHOST = host;
      process.env.PGUSER = user;
      process.env.PGDATABASE = database;
      process.env.PGPASSWORD = password;
      process.env.PGPORT = port;

      poolConfig = {
        host,
        user,
        password,
        database,
        port: parseInt(port),
        ssl: true,
      };
    }
  } catch (e) {
    console.error("DEBUG: Failed to parse DATABASE_URL as URL", e);
  }
} else {
  // Sur Vercel, utiliser les requêtes HTTP (fetch) beaucoup plus adaptées et rapides en serverless
  neonConfig.poolQueryViaFetch = true;
}

// Créer l'adaptateur Prisma avec la configuration du pool directement
const adapter = new PrismaNeon(poolConfig);

// ✅ Utiliser l'adapter pour Prisma
export const prisma = new PrismaClient({ adapter });

export default prisma;