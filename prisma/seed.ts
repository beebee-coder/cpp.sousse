import 'dotenv/config'; 
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

/**
 * Script d'amorçage industriel VisioNode V9.2.
 * Version : Correction critique OpenSSL & Chargement Env.
 */
async function main() {
  const startTime = Date.now();
  console.log('🌱 [SEED] Initialisation du Registre Industriel...');
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ [SEED] DATABASE_URL non définie. Vérifiez votre fichier .env ou .env.local');
    process.exit(1);
  }

  // Configuration Neon pour environnement Cloud (Force HTTPS et évite les erreurs libssl locale)
  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);
  
  // Cast 'as any' car les types générés peuvent être désynchronisés pendant la phase libssl
  const prisma = new PrismaClient({ adapter } as any);

  try {
    console.log('📡 [SEED] Tentative de liaison SQL Neon...');
    await prisma.$connect();
    console.log('✅ [SEED] Liaison établie.');

    // 1. CRÉATION DE L'ADMIN SYSTÈME
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
        id: 'admin-root-001',
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

    console.log(`✅ [SEED] Compte Admin configuré : ${admin.email}`);

    // 2. INJECTION DES CONNAISSANCES DE BASE
    const knowledgeItems = [
      {
        id: 'seed-k-epi-crf',
        title: 'Sécurité CRF - EPI',
        type: 'qa',
        question: 'Quels sont les EPI obligatoires en zone CRF ?',
        answer: 'Casque, gants anti-coupure, lunettes S3, chaussures de sécurité.',
        category: 'Sécurité'
      },
      {
        id: 'seed-k-pompe-p01',
        title: 'Maintenance Pompe P01',
        type: 'qa',
        question: 'Quelle est la température maximale des paliers ?',
        answer: 'La température ne doit pas excéder 90°C en régime nominal.',
        category: 'Maintenance'
      }
    ];

    for (const k of knowledgeItems) {
      await prisma.knowledgeItem.upsert({
        where: { id: k.id },
        update: { ...k },
        create: {
          ...k,
          userId: admin.id,
          tags: ['CRF', 'MAINTENANCE'],
          isPublic: true,
          syncedLocal: true
        }
      });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n📊 [SEED] Registre amorcé avec succès en ${duration}s.`);

  } catch (error: any) {
    console.error('❌ [SEED] Échec critique du moteur SQL :');
    console.error(error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
