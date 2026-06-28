import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

// ✅ Configurer WebSocket pour contourner les pare-feux
neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = false;

const connectionString = process.env.DATABASE_URL || '';

// Parser la chaîne de connexion pour contourner les erreurs internes du driver et initialiser les variables PG
let poolConfig: any = { connectionString };
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

// Créer l'adaptateur Prisma avec la configuration du pool directement
const adapter = new PrismaNeon(poolConfig);

// ✅ Utiliser l'adapter pour Prisma
export const prisma = new PrismaClient({ adapter });

export default prisma;