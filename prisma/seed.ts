import 'dotenv/config';  // ✅ Charger .env.local
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// ============================================================
// 📋 DONNÉES PAR DÉFAUT
// ============================================================

const ADMIN_EMAIL = process.env.AUTH_ADMIN_EMAIL || 'admin@visionode.local';
const ADMIN_FIRST_NAME = process.env.AUTH_ADMIN_FIRST_NAME || 'System';
const ADMIN_LAST_NAME = process.env.AUTH_ADMIN_LAST_NAME || 'Administrator';
const ADMIN_PASSWORD = process.env.AUTH_ADMIN_PASSWORD || 'admin123';

const DEFAULT_KNOWLEDGE = [
  {
    title: 'Sécurité CRF - EPI Obligatoires',
    type: 'qa',
    question: 'Quels sont les EPI obligatoires en zone CRF ?',
    answer: 'Casque de sécurité, gants anti-coupure, lunettes de protection S3, chaussures de sécurité.',
    tags: ['EPI', 'Sécurité', 'CRF'],
    category: 'Sécurité',
    difficulty: 'medium',
    isPublic: true
  },
  {
    title: 'Procédure d\'urgence CRF',
    type: 'procedure',
    question: 'Que faire en cas de fuite de gaz dans le CRF ?',
    answer: '1. Activer l\'alarme\n2. Évacuer la zone\n3. Contacter le chef de quart\n4. Suivre la procédure d\'urgence',
    tags: ['Urgence', 'Sécurité'],
    category: 'Urgence',
    difficulty: 'high',
    isPublic: true
  },
  {
    title: 'Maintenance préventive CRF',
    type: 'guide',
    question: 'Quand effectuer la maintenance préventive du CRF ?',
    answer: 'Maintenance mensuelle : vérification des pressions, nettoyage des filtres.\nMaintenance trimestrielle : inspection complète des compresseurs.',
    tags: ['Maintenance', 'CRF'],
    category: 'Maintenance',
    difficulty: 'medium',
    isPublic: true
  }
];

// ============================================================
// 🚀 FONCTION PRINCIPALE
// ============================================================

async function main() {
  const startTime = Date.now();
  console.log('🌱 [SEED] Amorçage industriel VisioNode...');
  console.log(`📡 [SEED] Environnement: ${process.env.NODE_ENV || 'development'}`);
  
  const dbUrl = process.env.DATABASE_URL || '';
  console.log(`📡 [SEED] DATABASE_URL: ${dbUrl ? '✅ Définie' : '❌ Non définie'}`);

  try {
    console.log('🔌 [SEED] Vérification de la connexion...');
    await prisma.$connect();
    console.log('✅ [SEED] Connexion à la base de données établie.');

    // ============================================================
    // 👤 CRÉATION DE L'ADMIN
    // ============================================================
    console.log('👤 [SEED] Création de l\'utilisateur administrateur...');

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
    
    const admin = await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        firstName: ADMIN_FIRST_NAME,
        lastName: ADMIN_LAST_NAME,
        password: hashedPassword,
        role: 'admin',
        approved: true,
        updatedAt: new Date()
      },
      create: {
        id: `admin-${Date.now()}`,
        firstName: ADMIN_FIRST_NAME,
        lastName: ADMIN_LAST_NAME,
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: 'admin',
        approved: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
    });

    console.log(`✅ [SEED] Admin créé : ${admin.email} (${admin.id})`);
    console.log(`   📝 Mot de passe : ${ADMIN_PASSWORD}`);

    // ============================================================
    // 📂 INJECTION DE LA PROCÉDURE CRF
    // ============================================================
    console.log('📂 [SEED] Recherche de la procédure CRF...');

    const crfPath = path.join(process.cwd(), 'data', 'procedure-demarrage-CRF.json');
    
    if (fs.existsSync(crfPath)) {
      try {
        const crfData = JSON.parse(fs.readFileSync(crfPath, 'utf8'));
        await prisma.procedure.upsert({
          where: { code: crfData.metadata?.code || 'proc-crf-default' },
          update: {
            steps: crfData.steps || [],
            prerequisites: crfData.prerequisites || {},
            metadata: crfData.metadata || {},
            updatedAt: new Date()
          },
          create: {
            id: crfData._id || `proc-${Date.now()}`,
            code: crfData.metadata?.code || 'PROC-CRF-001',
            title: crfData.metadata?.title || 'Démarrage Système CRF',
            description: 'Système de Réfrigération Principal',
            category: crfData.metadata?.category || 'STARTUP',
            department: crfData.metadata?.department || 'PRODUCTION',
            criticality: crfData.metadata?.criticality || 'CRITICAL',
            version: crfData.metadata?.version || '1.0.0',
            status: crfData.metadata?.status || 'APPROVED',
            prerequisites: crfData.prerequisites || {},
            steps: crfData.steps || [],
            metadata: crfData.metadata || {},
            authorId: admin.id,
            executionCount: 0,
            syncedLocal: true,
            createdAt: new Date(),
            updatedAt: new Date()
          },
        });
        console.log(`✅ [SEED] Procédure ${crfData.metadata?.code || 'PROC-CRF-001'} injectée.`);
      } catch (err: any) {
        console.warn('⚠️ [SEED] Erreur injection CRF:', err.message);
        await createDefaultProcedure(admin.id);
      }
    } else {
      console.log('ℹ️ [SEED] Aucun fichier CRF trouvé. Création d\'une procédure par défaut...');
      await createDefaultProcedure(admin.id);
    }

    // ============================================================
    // 📚 INJECTION DES CONNAISSANCES
    // ============================================================
    console.log('📚 [SEED] Injection des connaissances...');

    let knowledgeCount = 0;
    for (const k of DEFAULT_KNOWLEDGE) {
      try {
        await prisma.knowledgeItem.create({
          data: {
            id: `kn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            userId: admin.id,
            type: k.type,
            title: k.title,
            question: k.question || null,
            answer: k.answer || null,
            tags: k.tags,
            category: k.category || null,
            difficulty: k.difficulty || 'medium',
            isPublic: k.isPublic !== undefined ? k.isPublic : true,
            syncedLocal: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        knowledgeCount++;
      } catch (err: any) {
        console.warn(`⚠️ [SEED] Erreur pour "${k.title}": ${err.message}`);
      }
    }

    console.log(`✅ [SEED] ${knowledgeCount} connaissances injectées.`);

    // ============================================================
    // 📊 RÉSUMÉ
    // ============================================================
    const userCount = await prisma.user.count();
    const procCount = await prisma.procedure.count();
    const knowCount = await prisma.knowledgeItem.count();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n📊 [SEED] Résumé :');
    console.log(`   👤 Utilisateurs : ${userCount}`);
    console.log(`   📋 Procédures : ${procCount}`);
    console.log(`   📚 Connaissances : ${knowCount}`);
    console.log(`   ⏱️  Durée : ${duration}s`);
    console.log('✅ [SEED] Amorçage terminé avec succès !');

  } catch (error: any) {
    console.error('❌ [SEED] Erreur fatale:', error.message);
    console.error('📄 [SEED] Stack:', error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('🔌 [SEED] Déconnexion de la base de données.');
  }
}

async function createDefaultProcedure(authorId: string) {
  await prisma.procedure.upsert({
    where: { code: 'PROC-DEFAULT-001' },
    update: { updatedAt: new Date() },
    create: {
      id: `proc-${Date.now()}`,
      code: 'PROC-DEFAULT-001',
      title: 'Procédure par défaut',
      description: 'Procédure générique de démarrage',
      category: 'STARTUP',
      department: 'PRODUCTION',
      criticality: 'MEDIUM',
      version: '1.0.0',
      status: 'DRAFT',
      prerequisites: {},
      steps: [
        { order: 1, description: 'Vérifier les alarmes', status: 'pending' },
        { order: 2, description: 'Vérifier les pressions', status: 'pending' },
        { order: 3, description: 'Démarrer le système', status: 'pending' }
      ],
      metadata: {},
      authorId: authorId,
      executionCount: 0,
      syncedLocal: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });
  console.log('✅ [SEED] Procédure par défaut créée.');
}

main()
  .catch((e) => {
    console.error('❌ [SEED] Échec:', e);
    process.exit(1);
  });