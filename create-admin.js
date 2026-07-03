import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// ✅ Pour Prisma 7, on utilise le client directement sans options
// La configuration est dans prisma.config.ts
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔧 Connexion à la base de données...');
    await prisma.$connect();
    console.log('✅ Connecté avec succès');

    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);
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
    console.log('   🔑 Mot de passe: admin123');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
