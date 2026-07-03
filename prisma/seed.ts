import 'dotenv/config'; 
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

/**
 * Script d'amorçage industriel VisioNode.
 * Version : Prisma 5.22.0 + Neon Serverless.
 */
async function main() {
  const startTime = Date.now();
  console.log('🌱 [SEED] Initialisation du Registre Industriel...');
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ [SEED] DATABASE_URL non définie dans l\'environnement.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$connect();
    console.log('✅ [SEED] Liaison SQL établie avec Neon.');

    // 1. CRÉATION DE L'ADMIN
    const adminEmail = process.env.AUTH_ADMIN_EMAIL || 'admin@visionode.local';
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        role: 'admin',
        approved: true,
        updatedAt: new Date()
      },
      create: {
        firstName: 'Ahmed',
        lastName: 'Admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        approved: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
    });

    console.log(`✅ [SEED] Admin configuré : ${admin.email}`);

    // 2. INJECTION DES CONNAISSANCES DE BASE
    const knowledge = [
      {
        title: 'Sécurité CRF - EPI',
        type: 'qa',
        question: 'Quels sont les EPI obligatoires en zone CRF ?',
        answer: 'Casque, gants anti-coupure, lunettes S3, chaussures de sécurité.',
        category: 'Sécurité'
      }
    ];

    for (const k of knowledge) {
      await prisma.knowledgeItem.upsert({
        where: { id: `seed-k-${k.title.replace(/\s+/g, '-').toLowerCase()}` },
        update: { ...k },
        create: {
          id: `seed-k-${k.title.replace(/\s+/g, '-').toLowerCase()}`,
          ...k,
          userId: admin.id,
          tags: ['EPI', 'CRF'],
          isPublic: true,
          syncedLocal: true
        }
      });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n📊 [SEED] Terminé avec succès en ${duration}s.`);

  } catch (error: any) {
    console.error('❌ [SEED] Échec critique :', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();