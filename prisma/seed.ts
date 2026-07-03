// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

// Chargement forcé de l'environnement
dotenv.config();

if (typeof window === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

async function main() {
  console.log('🌱 [SEED] Initialisation du Registre Industriel (Latest Prisma 7)...');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ [SEED] DATABASE_URL manquante. Vérifiez le fichier .env');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool as any);
  
  // Utilisation d'une instanciation robuste compatible Prisma 7
  const prisma = new PrismaClient({ adapter: adapter as any } as any);

  try {
    console.log('👤 [SEED] Audit de l\'administrateur root...');
    const hashedAdminPassword = await bcrypt.hash('admin123', 12);
    
    const admin = await prisma.user.upsert({
      where: { email: 'admin@visionode.local' },
      update: { approved: true, role: 'admin' },
      create: {
        id: 'admin-root',
        email: 'admin@visionode.local',
        firstName: 'Ahmed',
        lastName: 'Admin',
        password: hashedAdminPassword,
        role: 'admin',
        approved: true,
      },
    });
    console.log(`✅ [SEED] Administrateur accrédité : ${admin.email}`);

    console.log('📚 [SEED] Injection des référentiels sémantiques...');
    const knowledgeItems = [
      {
        id: 'seed-k-epi',
        title: 'EPI Obligatoires - Zone CRF',
        type: 'qa',
        question: 'Quels sont les EPI obligatoires en zone CRF ?',
        answer: 'Casque, gants, lunettes de protection et chaussures de sécurité.',
        tags: ['EPI', 'SÉCURITÉ'],
        category: 'SÉCURITÉ'
      }
    ];

    for (const item of knowledgeItems) {
      await prisma.knowledgeItem.upsert({
        where: { id: item.id },
        update: {},
        create: {
          ...item,
          userId: admin.id,
          isPublic: true,
        }
      });
    }

    console.log('✅ [SEED] Référentiels injectés avec succès.');

  } catch (error: any) {
    console.error('❌ [SEED] Échec critique :', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
