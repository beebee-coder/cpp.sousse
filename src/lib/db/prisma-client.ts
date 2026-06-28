import { PrismaClient } from '@prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

// ✅ Configurer WebSocket pour contourner les pare-feux
neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;

const connectionString = process.env.DATABASE_URL || '';

// Créer un pool de connexions avec WebSocket
const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool as any);

// ✅ Utiliser l'adapter pour Prisma
export const prisma = new PrismaClient({ adapter });

export default prisma;