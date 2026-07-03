// prisma/seed.ts
import 'dotenv/config'; // ✅ CHARGEMENT EXPLICITE DES ENV
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.AUTH_ADMIN_EMAIL || 'admin@visionode.local';
const ADMIN_PASSWORD = process.env.AUTH_ADMIN_PASSWORD || 'Admin@2024!';

async function main() {
  console.log('🌱 [SEED] Amorçage industriel VisioNode...');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ [SEED] DATABASE_URL manquante. Vérifiez votre fichier .env');
    process.exit(1);
  }

  try {
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
    
    // 1. Création Admin
    const admin = await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: { password: hashedPassword, approved: true },
      create: {
        firstName: 'System',
        lastName: 'Administrator',
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: 'admin',
        approved: true,
      },
    });
    console.log(`✅ [SEED] Admin configuré : ${admin.email}`);

    // 2. Injection Procédure CRF
    const crfPath = path.join(process.cwd(), 'data', 'procedure-demarrage-CRF.json');
    if (fs.existsSync(crfPath)) {
      const crfData = JSON.parse(fs.readFileSync(crfPath, 'utf8'));
      await prisma.procedure.upsert({
        where: { code: crfData.metadata?.code || 'CRF-START-001' },
        update: { steps: crfData.steps, metadata: crfData.metadata },
        create: {
          id: crfData._id || `proc-crf-${Date.now()}`,
          code: crfData.metadata?.code || 'CRF-START-001',
          title: crfData.metadata?.title || 'Démarrage Pompe CRF',
          category: 'STARTUP',
          prerequisites: crfData.prerequisites || {},
          steps: crfData.steps || [],
          metadata: crfData.metadata || {},
          authorId: admin.id,
          status: 'APPROVED',
        },
      });
      console.log('✅ [SEED] Procédure CRF injectée.');
    }

    console.log('🏁 [SEED] Terminé avec succès.');
  } catch (e: any) {
    console.error('❌ [SEED] Échec critique :', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
