import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Amorçage de la base de données VisioNode...');

  // 1. Création des utilisateurs de référence
  const adminPassword = await bcrypt.hash('Admin@2024!', 12);
  const chefPassword = await bcrypt.hash('Chef@2024!', 12);

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

  const chef = await prisma.user.upsert({
    where: { email: 'chef@visionode.local' },
    update: {},
    create: {
      id: 'chef-001',
      firstName: 'Chef',
      lastName: 'Bloc A',
      email: 'chef@visionode.local',
      password: chefPassword,
      role: 'chef-de-bloc',
      approved: true,
    },
  });

  console.log('✅ Utilisateurs créés.');

  // 2. Importation de la procédure CRF réelle
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
          parameters: crfData.parameters,
          postExecution: crfData.postExecution,
          metadata: crfData.metadata,
          authorId: admin.id,
        },
      });
      console.log('✅ Procédure CRF-START-001 injectée avec succès.');
    }
  } catch (err: any) {
    console.warn('⚠️ Échec injection procédure CRF:', err.message);
  }

  // 3. Connaissances sémantiques initiales
  const knowledge = [
    {
      title: 'Sécurité POMPE CRF',
      type: 'qa',
      question: 'Quelles sont les EPI obligatoires pour la zone CRF ?',
      answer: 'Casque, gants nitrile, lunettes de protection et chaussures de sécurité S3.',
      tags: ['sécurité', 'CRF', 'EPI'],
      category: 'Sécurité',
    },
    {
      title: 'Procédure Initialisation Registre',
      type: 'qa',
      question: 'Comment initialiser le registre central ?',
      answer: 'Vérifiez l\'intégrité des fichiers .json dans le dossier .registry, puis lancez la synchronisation via le panneau Cloud.',
      tags: ['registre', 'système'],
      category: 'Opération',
    }
  ];

  for (const k of knowledge) {
    await prisma.knowledgeItem.create({
      data: {
        ...k,
        userId: admin.id,
      },
    });
  }

  console.log('✅ Base de connaissances initialisée.');
  console.log('🚀 Système prêt pour l\'audit industriel.');
}

main()
  .catch((e) => {
    console.error('❌ Erreur critique lors du seed :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
