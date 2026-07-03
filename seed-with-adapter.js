// seed-with-adapter.js
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool);

// ✅ Utiliser l'adaptateur
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    console.log('🔧 Connexion avec adaptateur Neon...');
    await prisma.$connect();
    console.log('✅ Connecté avec succès');

    const hashedPassword = await bcrypt.hash('admin123', 10);
    console.log('✅ Hash généré');

    const admin = await prisma.user.upsert({
      where: { email: 'admin@visionode.local' },
      update: {
        password: hashedPassword,
        approved: true,
        role: 'admin',
        firstName: 'Ahmed',
        lastName: 'Admin'
      },
      create: {
        email: 'admin@visionode.local',
        firstName: 'Ahmed',
        lastName: 'Admin',
        password: hashedPassword,
        role: 'admin',
        approved: true
      }
    });

    console.log('✅ Admin créé:', admin.email);
    console.log('   Mot de passe: admin123');
    console.log('   Rôle:', admin.role);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
