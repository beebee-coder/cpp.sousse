// prisma/seed.ts
import { config } from 'dotenv';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/db/prisma-client';
import bcrypt from 'bcryptjs';

// Chargement robuste des variables d'environnement
const envPath = resolve(process.cwd(), '.env.local');
config({ path: fs.existsSync(envPath) ? envPath : resolve(process.cwd(), '.env') });

const ADMIN_EMAIL = process.env.AUTH_ADMIN_EMAIL || 'admin@visionode.local';
const ADMIN_PASSWORD = process.env.AUTH_ADMIN_PASSWORD || 'Admin@2024!';

async function main() {
  console.log('🌱 [SEED] Initialisation du Registre Industriel...');

  try {
    // 1. Validation de la liaison
    await prisma.$connect();
    console.log('🔗 [SEED] Liaison Neon établie.');

    // 2. Création de l'Administrateur Racine
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const admin = await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        password: hashedPassword,
        approved: true,
        role: 'admin'
      },
      create: {
        id: 'admin-root',
        firstName: 'System',
        lastName: 'Administrator',
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: 'admin',
        approved: true
      },
    });
    console.log(`✅ [SEED] Admin configuré : ${admin.email}`);

    // 3. Injection Procédure CRF de référence (depuis JSON)
    const crfPath = path.join(process.cwd(), 'data', 'procedure-demarrage-CRF.json');
    if (fs.existsSync(crfPath)) {
      const crfData = JSON.parse(fs.readFileSync(crfPath, 'utf8'));
      const procCode = crfData.metadata?.code || 'CRF-START-001';
      
      await prisma.procedure.upsert({
        where: { code: procCode },
        update: {
          steps: crfData.steps || [],
          prerequisites: crfData.prerequisites || {},
          metadata: crfData.metadata || {},
          title: crfData.metadata?.title || 'Démarrage Système CRF'
        },
        create: {
          id: 'proc-crf-001',
          code: procCode,
          title: crfData.metadata?.title || 'Démarrage Système CRF',
          category: 'STARTUP',
          department: 'PRODUCTION',
          criticality: 'CRITICAL',
          prerequisites: crfData.prerequisites || { description: 'Audit standard', items: [] },
          steps: crfData.steps || [],
          metadata: crfData.metadata || {},
          authorId: admin.id,
          status: 'APPROVED'
        }
      });
      console.log(`✅ [SEED] Actif industriel injecté : ${procCode}`);
    }

    // 4. Connaissances sémantiques par défaut
    const knowledgeCount = await prisma.knowledgeItem.count();
    if (knowledgeCount === 0) {
      await prisma.knowledgeItem.create({
        data: {
          userId: admin.id,
          type: 'qa',
          title: 'Sécurité CRF - EPI Obligatoires',
          question: 'Quels sont les EPI obligatoires en zone CRF ?',
          answer: 'Casque de sécurité, gants anti-coupure, lunettes de protection S3, chaussures de sécurité.',
          tags: ['EPI', 'Sécurité', 'CRF'],
          category: 'Sécurité',
          isPublic: true
        }
      });
      console.log('✅ [SEED] Mémoire sémantique initialisée.');
    }

    console.log('✨ [SEED] Opération terminée avec succès.');

  } catch (error: any) {
    console.error('❌ [SEED] Échec critique :', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
