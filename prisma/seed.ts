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
  console.log('🌱 [SEED] Initialisation du Registre Industriel VisioNode...');

  try {
    // 1. Validation de la liaison Neon
    await prisma.$connect();
    console.log('🔗 [SEED] Liaison Neon/Postgres établie.');

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

    // 3. Injection des Procédures de référence (depuis data/)
    const dataDir = path.join(process.cwd(), 'data');
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        try {
          const filePath = path.join(dataDir, file);
          const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          if (rawData._type === 'industrial_procedure' || rawData.steps) {
            const procCode = rawData.metadata?.code || rawData.code || `PROC-${file.replace('.json', '')}`;
            
            await prisma.procedure.upsert({
              where: { code: procCode },
              update: {
                title: rawData.metadata?.title || rawData.title,
                steps: rawData.steps || [],
                prerequisites: rawData.prerequisites || { items: [] },
                metadata: rawData.metadata || rawData,
                status: 'APPROVED'
              },
              create: {
                id: rawData._id || `proc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                code: procCode,
                title: rawData.metadata?.title || rawData.title,
                category: (rawData.metadata?.category || 'OPERATION').toUpperCase(),
                department: (rawData.metadata?.department || 'PRODUCTION').toUpperCase(),
                criticality: (rawData.metadata?.criticality || 'MEDIUM').toUpperCase(),
                prerequisites: rawData.prerequisites || { description: 'Audit standard', items: [] },
                steps: rawData.steps || [],
                metadata: rawData.metadata || rawData,
                authorId: admin.id,
                status: 'APPROVED'
              }
            });
            console.log(`✅ [SEED] Actif injecté : ${procCode}`);
          }
        } catch (e: any) {
          console.warn(`⚠️ [SEED] Erreur sur fichier ${file} :`, e.message);
        }
      }
    }

    // 4. Connaissances sémantiques par défaut
    const initialKnowledgeId = 'knowledge-initial-001';
    await prisma.knowledgeItem.upsert({
      where: { id: initialKnowledgeId },
      update: {},
      create: {
        id: initialKnowledgeId,
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

    console.log('✨ [SEED] Opération terminée avec succès.');

  } catch (error: any) {
    console.error('❌ [SEED] Échec critique :', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
