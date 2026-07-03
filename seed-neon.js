// seed-neon.js
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Charger .env.local
dotenv.config({ path: '.env.local' });

// ✅ Configurer explicitement la connexion
const connectionString = process.env.DATABASE_URL;
console.log('📡 DATABASE_URL:', connectionString ? '✅ Définie' : '❌ Non définie');

if (!connectionString) {
  console.error('❌ DATABASE_URL non définie dans .env.local');
  process.exit(1);
}

// Créer le pool avec la connexion explicite
const pool = new Pool({ 
  connectionString,
  // Forcer la configuration
  max: 10,
  idleTimeoutMillis: 30000,
});

const adapter = new PrismaNeon(pool);
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

    console.log('✅ Admin créé avec succès !');
    console.log('   📧 Email:', admin.email);
    console.log('   👤 Nom:', admin.firstName, admin.lastName);
    console.log('   🔑 Rôle:', admin.role);
    console.log('   🔐 Mot de passe: admin123');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error('📄 Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Déconnecté');
  }
}

main();
