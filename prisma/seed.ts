// prisma/seed.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import bcrypt from 'bcryptjs';

// Configuration WebSocket pour le script Node
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;

async function main() {
  console.log('🌱 [SEED] Initialisation du Registre Industriel...');

  if (!connectionString) {
    console.error('❌ [SEED] DATABASE_URL non trouvée dans .env');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. CRÉATION DE L'ADMIN SOUVERAIN
    console.log('👤 [SEED] Audit de l\'administrateur root...');
    const hashedAdminPassword = await bcrypt.hash('66023', 12);
    
    await prisma.user.upsert({
      where: { email: 'admin@visionode.local' },
      update: { approved: true, role: 'admin' },
      create: {
        id: 'admin-root',
        email: 'admin@visionode.local',
        firstName: 'ahmed',
        lastName: 'abbes',
        password: hashedAdminPassword,
        role: 'admin',
        approved: true,
      },
    });
    console.log('✅ [SEED] Administrateur accrédité.');

    // 2. INJECTION DES CONNAISSANCES DE SÉCURITÉ
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
          userId: 'admin-root',
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
