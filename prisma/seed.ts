
// prisma/seed.ts - Version Stable V5
import { prisma } from '../src/lib/db/prisma-client';
import bcrypt from 'bcryptjs';

async function main() {
  const ts = new Date().toLocaleTimeString();
  console.log(`🌱 [${ts}] [SEED] Initialisation du Registre Industriel.`);

  try {
    const hashedAdminPassword = await bcrypt.hash('admin123', 12);
    
    console.log('👤 [SEED] Audit de l\'administrateur root...');
    const admin = await prisma.user.upsert({
      where: { email: 'admin@visionode.local' },
      update: { approved: true, role: 'admin' },
      create: {
        id: 'admin-root',
        email: 'admin@visionode.local',
        firstName: 'Ahmed',
        lastName: 'Admin',
        password: hashedAdminPassword,
        role: 'admin',
        approved: true,
      },
    });
    console.log(`✅ [SEED] Administrateur accrédité : ${admin.email}`);

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
          userId: admin.id,
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
  }
}

main();
