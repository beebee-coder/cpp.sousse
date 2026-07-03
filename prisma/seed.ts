// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

/**
 * Script d'amorçage industriel VisioNode - Prisma 7.8.0 Certifié.
 * Solution d'injection directe pour résoudre l'erreur "No database host".
 */

// 1. Chargement explicite de l'environnement
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

if (typeof window === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

async function main() {
  console.log('🌱 [SEED] Initialisation du Registre Industriel (Latest Prisma 7)...');

  // 2. Récupération et nettoyage de la chaîne de connexion
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    console.error('❌ [SEED] DATABASE_URL manquante.');
    process.exit(1);
  }

  const connectionString = rawUrl.replace(/^"|"$/g, '');
  console.log(`📡 [SEED] Liaison Neon explicite détectée.`);

  // 3. Initialisation forcée de l'adaptateur
  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);
  
  // @ts-ignore - On force l'utilisation de l'adapter en v7
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('👤 [SEED] Audit de l\'administrateur root...');
    const hashedAdminPassword = await bcrypt.hash('admin123', 12);
    
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
    await pool.end();
  }
}

main();
