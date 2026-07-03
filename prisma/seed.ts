// prisma/seed.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// ✅ Utiliser prisma.config.ts pour la configuration
const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.AUTH_ADMIN_EMAIL || 'admin@visionode.local';
const ADMIN_PASSWORD = process.env.AUTH_ADMIN_PASSWORD || '66023';
const ADMIN_FIRST_NAME = process.env.AUTH_ADMIN_FIRST_NAME || 'ahmed';
const ADMIN_LAST_NAME = process.env.AUTH_ADMIN_LAST_NAME || 'abbes';

const KNOWLEDGE_ITEMS = [
  {
    id: 'seed-k-epi-crf',
    title: 'Sécurité CRF - EPI Obligatoires',
    type: 'qa',
    question: 'Quels sont les EPI obligatoires en zone CRF ?',
    answer: 'Casque de sécurité, gants anti-coupure, lunettes de protection S3, chaussures de sécurité.',
    tags: ['EPI', 'Sécurité', 'CRF'],
    category: 'Sécurité',
    difficulty: 'medium'
  },
  {
    id: 'seed-k-pompe-p01',
    title: 'Maintenance Pompe P01',
    type: 'qa',
    question: 'Quelle est la température maximale des paliers ?',
    answer: 'La température ne doit pas excéder 90°C en régime nominal.',
    tags: ['Maintenance', 'Pompe'],
    category: 'Maintenance',
    difficulty: 'medium'
  },
  {
    id: 'seed-k-procedure-crf',
    title: 'Procédure démarrage CRF',
    type: 'procedure',
    question: 'Quelles sont les étapes de démarrage du CRF ?',
    answer: '1. Vérifier les prérequis\n2. Démarrer la séquence CFI\n3. Attendre 6 minutes\n4. Démarrer le moteur\n5. Ouvrir la vanne progressivement',
    tags: ['CRF', 'Démarrage', 'Procédure'],
    category: 'Procédure',
    difficulty: 'high'
  }
];

async function main() {
  const startTime = Date.now();
  console.log('🌱 [SEED] Initialisation du Registre Industriel...');
  console.log(`📡 [SEED] Connexion à: ${process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@')}`);

  try {
    // 1. CONNEXION
    await prisma.$connect();
    console.log('✅ [SEED] Connexion établie');

    // 2. CRÉATION DE L'ADMIN
    console.log('👤 [SEED] Création de l\'administrateur...');
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

    const admin = await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        password: hashedPassword,
        approved: true,
        role: 'admin',
        firstName: ADMIN_FIRST_NAME,
        lastName: ADMIN_LAST_NAME,
        updatedAt: new Date()
      },
      create: {
        id: `admin-${Date.now()}`,
        email: ADMIN_EMAIL,
        firstName: ADMIN_FIRST_NAME,
        lastName: ADMIN_LAST_NAME,
        password: hashedPassword,
        role: 'admin',
        approved: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log(`✅ [SEED] Admin configuré: ${admin.email}`);
    console.log(`   🔑 Mot de passe: ${ADMIN_PASSWORD}`);

    // 3. INJECTION DES CONNAISSANCES
    console.log('📚 [SEED] Injection des connaissances...');
    let knowledgeCount = 0;

    for (const item of KNOWLEDGE_ITEMS) {
      try {
        await prisma.knowledgeItem.upsert({
          where: { id: item.id },
          update: {
            title: item.title,
            type: item.type,
            question: item.question,
            answer: item.answer,
            tags: item.tags,
            category: item.category,
            difficulty: item.difficulty,
            updatedAt: new Date()
          },
          create: {
            id: item.id,
            userId: admin.id,
            type: item.type,
            title: item.title,
            question: item.question,
            answer: item.answer,
            tags: item.tags,
            category: item.category,
            difficulty: item.difficulty,
            isPublic: true,
            syncedLocal: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        knowledgeCount++;
        console.log(`   ✅ ${item.title}`);
      } catch (error: any) {
        console.warn(`   ⚠️ Erreur pour "${item.title}": ${error.message}`);
      }
    }

    console.log(`✅ ${knowledgeCount}/${KNOWLEDGE_ITEMS.length} connaissances injectées`);

    // 4. STATISTIQUES FINALES
    const userCount = await prisma.user.count();
    const procCount = await prisma.procedure.count();
    const knowCount = await prisma.knowledgeItem.count();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n📊 [SEED] RÉSUMÉ:');
    console.log(`   👤 Utilisateurs: ${userCount}`);
    console.log(`   📋 Procédures: ${procCount}`);
    console.log(`   📚 Connaissances: ${knowCount}`);
    console.log(`   ⏱️  Durée: ${duration}s`);
    console.log('✅ [SEED] Terminé avec succès !');

  } catch (error: any) {
    console.error('❌ [SEED] Échec:', error.message);
    console.error('📄 [SEED] Stack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 [SEED] Déconnecté');
  }
}

main();
