import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

async function createPrismaClientWithRetry(
  connectionString: string,
  maxRetries = 3,
  baseDelayMs = 500
): Promise<PrismaClient> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const adapter = new PrismaNeon({ connectionString });
      const client = new PrismaClient({ adapter });
      await client.$connect();
      return client;
    } catch (err: any) {
      lastError = err;
      const isRetryable =
        err.code === 'P1001' ||
        err.code === 'P1002' ||
        err.message?.includes('timeout') ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('ENOTFOUND');

      if (attempt < maxRetries - 1 && isRetryable) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.warn(
          `⚠️ [Prisma] Connexion échouée (${err.message}). Nouvelle tentative ${attempt + 1}/${maxRetries} dans ${delay}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Échec inattendu de la connexion Prisma');
}

export async function createPrismaClient(): Promise<PrismaClient> {
  const ts = new Date().toLocaleTimeString();
  const rawUrl = process.env.DATABASE_URL || '';
  const connectionString = rawUrl.replace(/^"|"$/g, '').trim();

  if (!connectionString) {
    throw new Error(`DATABASE_URL manquante. Définissez-la dans le fichier .env avant de lancer l'application.`);
  }

  console.log(`📡 [${ts}] [Prisma] Liaison Adaptateur Neon V7.`);
  const client = await createPrismaClientWithRetry(connectionString);
  console.log(`✅ [${ts}] [Prisma] Connexion établie.`);
  return client;
}

let prismaInstance: PrismaClient | undefined;

export async function getPrismaClient(): Promise<PrismaClient> {
  if (!prismaInstance) {
    prismaInstance = await createPrismaClient();
    globalForPrisma.prisma = prismaInstance;
  }
  return prismaInstance;
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = undefined;
  }
}

export const prisma = globalForPrisma.prisma ?? prismaInstance;

export default prisma;
