import { prisma } from '../src/lib/db/prisma-client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🌱 [SEED] Amorçage industriel VisioNode...');

  // 1. Utilisateurs
  const adminPassword = await bcrypt.hash('Admin@2024!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@visionode.local' },
    update: {},
    create: {
      id: 'admin-root',
      firstName: 'System',
      lastName: 'Administrator',
      email: 'admin@visionode.local',
      password: adminPassword,
      role: 'admin',
      approved: true,
    },
  });

  console.log('✅ [SEED] Admin root créé.');

  // 2. Procédures CRF de référence
  try {
    const crfPath = path.join(process.cwd(), 'data', 'procedure-demarrage-CRF.json');
    if (fs.existsSync(crfPath)) {
      const crfData = JSON.parse(fs.readFileSync(crfPath, 'utf8'));
      await prisma.procedure.upsert({
        where: { code: crfData.metadata.code },
        update: {
          steps: crfData.steps,
          prerequisites: crfData.prerequisites,
          metadata: crfData.metadata,
        },
        create: {
          id: crfData._id || 'proc-crf-startup-001',
          code: crfData.metadata.code,
          title: crfData.metadata.title,
          description: 'Système de Réfrigération Principal',
          category: 'STARTUP',
          department: 'PRODUCTION',
          criticality: 'CRITICAL',
          version: crfData.metadata.version,
          status: 'APPROVED',
          prerequisites: crfData.prerequisites,
          steps: crfData.steps,
          metadata: crfData.metadata,
          authorId: admin.id,
        },
      });
      console.log(`✅ [SEED] Procédure ${crfData.metadata.code} injectée.`);
    }
  } catch (err: any) {
    console.warn('⚠️ [SEED] Erreur injection procédures:', err.message);
  }

  // 3. Connaissances sémantiques
  const knowledge = [
    { title: 'Sécurité CRF', type: 'qa', question: 'EPI Zone CRF ?', answer: 'Casque, gants, lunettes S3.', tags: ['EPI'], category: 'Sécurité' }
  ];

  for (const k of knowledge) {
    await prisma.knowledgeItem.create({ data: { ...k, userId: admin.id } });
  }

  console.log('✅ [SEED] Système prêt pour l\'audit.');
}

main()
  .catch((e) => { console.error('❌ [SEED] Erreur:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });