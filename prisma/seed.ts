
import { prisma } from '../src/lib/db/prisma-client';
import bcrypt from 'bcryptjs';

/**
 * Script d'amorçage industriel (V25.0).
 * Identifiants root : admin@visionode.local / admin123
 */
async function main() {
  const ts = new Date().toLocaleTimeString();
  console.log(`🌱 [${ts}] [SEED] Initialisation du Registre.`);

  try {
    const hashedAdminPassword = await bcrypt.hash('admin123', 12);

    console.log('👤 [SEED] Audit de l\'administrateur root...');
    const admin = await prisma.user.upsert({
      where: { email: 'admin@visionode.local' },
      update: {
        password: hashedAdminPassword,
        approved: true,
        role: 'admin',
        firstName: 'Ahmed',
        lastName: 'Admin',
        updatedAt: new Date()
      },
      create: {
        id: 'admin-root-001',
        email: 'admin@visionode.local',
        firstName: 'Ahmed',
        lastName: 'Admin',
        password: hashedAdminPassword,
        role: 'admin',
        approved: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log(`✅ [SEED] Admin configuré : ${admin.email}`);

    console.log('📚 [SEED] Injection des connaissances de base...');
    const knowledge = [
      {
        id: 'seed-k-epi-crf',
        title: 'Sécurité CRF - EPI Obligatoires',
        type: 'qa',
        question: 'Quels sont les EPI obligatoires en zone CRF ?',
        answer: 'Casque de sécurité, gants anti-coupure, lunettes de protection S3, chaussures de sécurité.',
        tags: ['EPI', 'Sécurité', 'CRF'],
        category: 'Sécurité'
      }
    ];

    for (const item of knowledge) {
      await prisma.knowledgeItem.upsert({
        where: { id: item.id },
        update: item,
        create: {
          ...item,
          userId: admin.id
        }
      });
    }

    console.log('✅ [SEED] Registre initialisé avec succès.');
  } catch (err: any) {
    console.error('❌ [SEED] Échec critique :', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
