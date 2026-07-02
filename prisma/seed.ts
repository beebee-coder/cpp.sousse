// prisma/seed.ts
import { config } from 'dotenv';
import { resolve } from 'path';
import { prisma } from '../src/lib/db/prisma-client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

// Charger explicitement les variables d'environnement
const envPath = resolve(process.cwd(), '.env.local');
config({ path: fs.existsSync(envPath) ? envPath : resolve(process.cwd(), '.env') });

const ADMIN_EMAIL = process.env.AUTH_ADMIN_EMAIL || 'admin@visionode.local';
const ADMIN_PASSWORD = process.env.AUTH_ADMIN_PASSWORD || 'Admin@2024!';

const DEFAULT_KNOWLEDGE = [
  {
    title: 'Sécurité CRF - EPI Obligatoires',
    type: 'qa',
    question: 'Quels sont les EPI obligatoires en zone CRF ?',
    answer: 'Casque de sécurité, gants anti-coupure, lunettes de protection S3, chaussures de sécurité.',
    tags: ['EPI', 'Sécurité', 'CRF'],
    category: 'Sécurité'
  },
  {
    title: 'Maintenance préventive CRF',
    type: 'guide',
    question: 'Quand effectuer la maintenance préventive du CRF ?',
    answer: 'Maintenance mensuelle : vérification des pressions. Trimestrielle : inspection compresseurs.',
    tags: ['Maintenance', 'CRF'],
    category: 'Maintenance'
  }
];

async function main() {
  console.log('🌱 [SEED] Amorçage industriel VisioNode...');

  try {
    // 1. Création de l'utilisateur administrateur
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

    // 2. Injection Procédure CRF (depuis JSON si existe)
    const crfPath = path.join(process.cwd(), 'data', 'procedure-demarrage-CRF.json');
    if (fs.existsSync(crfPath)) {
      const crfData = JSON.parse(fs.readFileSync(crfPath, 'utf8'));
      await prisma.procedure.upsert({
        where: { code: crfData.metadata?.code || 'CRF-START-001' },
        update: {
          steps: crfData.steps || [],
          prerequisites: crfData.prerequisites || {},
          metadata: crfData.metadata || {}
        },
        create: {
          id: 'proc-crf-001',
          code: crfData.metadata?.code || 'CRF-START-001',
          title: crfData.metadata?.title || 'Démarrage Système CRF',
          category: 'STARTUP',
          department: 'PRODUCTION',
          criticality: 'CRITICAL',
          prerequisites: crfData.prerequisites || {},
          steps: crfData.steps || [],
          metadata: crfData.metadata || {},
          authorId: admin.id,
          status: 'APPROVED'
        }
      });
      console.log('✅ [SEED] Procédure CRF injectée.');
    }

    // 3. Injection Connaissances
    for (const k of DEFAULT_KNOWLEDGE) {
      await prisma.knowledgeItem.create({
        data: {
          userId: admin.id,
          type: k.type,
          title: k.title,
          question: k.question,
          answer: k.answer,
          tags: k.tags,
          category: k.category,
          isPublic: true
        }
      });
    }
    console.log(`✅ [SEED] ${DEFAULT_KNOWLEDGE.length} connaissances indexées.`);

  } catch (error: any) {
    console.error('❌ [SEED] Échec critique :', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
