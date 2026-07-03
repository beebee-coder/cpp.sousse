// seed-simple.js - Version CommonJS
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// ✅ Créer le client avec des options de base
const prisma = new PrismaClient({
  // Pas d'options supplémentaires - la configuration vient de prisma.config.ts
});

async function main() {
  try {
    console.log('🔧 Connexion à la base...');
    await prisma.$connect();
    console.log('✅ Connecté');

    const hash = await bcrypt.hash('admin123', 10);
    console.log('✅ Hash généré');

    const admin = await prisma.user.upsert({
      where: { email: 'admin@visionode.local' },
      update: {
        password: hash,
        approved: true,
        role: 'admin',
        firstName: 'Ahmed',
        lastName: 'Admin'
      },
      create: {
        email: 'admin@visionode.local',
        firstName: 'Ahmed',
        lastName: 'Admin',
        password: hash,
        role: 'admin',
        approved: true
      }
    });

    console.log('✅ Admin créé:', admin.email);
    console.log('   Mot de passe: admin123');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
