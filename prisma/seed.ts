import { prisma } from '../src/lib/db/prisma-client';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

async function main() {
  console.log('🌱 Début du seed de la base de données...');

  // --- Utilisateurs ---
  const usersData = [
    {
      firstName: 'Admin',
      lastName: 'System',
      email: 'admin@visionode.local',
      password: 'Admin@2024!',
      role: 'admin',
      approved: true,
    },
    {
      firstName: 'Chef',
      lastName: 'Bloc A',
      email: 'chef@visionode.local',
      password: 'Chef@2024!',
      role: 'chef-de-bloc',
      approved: true,
    },
    {
      firstName: 'User',
      lastName: 'Test',
      email: 'user@visionode.local',
      password: 'User@2024!',
      role: 'user',
      approved: false, // En attente d'approbation admin
    },
  ];

  for (const u of usersData) {
    const hashedPassword = await bcrypt.hash(u.password, SALT_ROUNDS);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        password: hashedPassword,
        role: u.role,
        approved: u.approved,
      },
      create: {
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        password: hashedPassword,
        role: u.role,
        approved: u.approved,
      },
    });
    console.log(`✅ Utilisateur créé/mis à jour : ${user.email} (${user.role})`);
  }

  // --- Récupération du chef pour associer des connaissances ---
  const chef = await prisma.user.findUnique({
    where: { email: 'chef@visionode.local' },
  });

  if (chef) {
    const knowledgeData = [
      {
        userId: chef.id,
        type: 'qa',
        title: 'Comment redémarrer la pompe P-102 ?',
        question: 'Comment redémarrer la pompe P-102 en toute sécurité ?',
        answer:
          'Assurez-vous que la vanne V-10 est fermée. Appuyez sur le bouton vert du panneau principal, puis ouvrez la vanne V-10 progressivement à 20%.',
        tags: ['pompe', 'sécurité', 'démarrage'],
        category: 'Maintenance',
        difficulty: 'medium',
        isPublic: true,
      },
      {
        userId: chef.id,
        type: 'procedure',
        title: "Procédure d'inspection du compresseur C-200",
        steps: [
          'Isoler électriquement le compresseur (Consignation).',
          "Vérifier le niveau d'huile de lubrification.",
          "Inspecter visuellement les courroies d'entraînement.",
          "Nettoyer le filtre d'aspiration.",
          'Déconsigner et faire un test de rotation à vide.',
        ],
        tags: ['compresseur', 'inspection', 'routine'],
        category: 'Inspection',
        difficulty: 'hard',
        isPublic: true,
      },
    ];

    for (const k of knowledgeData) {
      // Cherche d'abord un existant, puis crée si absent
      const existing = await prisma.knowledgeItem.findFirst({
        where: { title: k.title },
      });

      if (!existing) {
        const item = await prisma.knowledgeItem.create({ data: k as any });
        console.log(`✅ Connaissance créée : ${item.title} (${item.type})`);
      } else {
        console.log(`ℹ️  Connaissance déjà existante : ${existing.title}`);
      }
    }
  }

  console.log('\n🌱 Seed terminé avec succès !');
  console.log('\n📋 Comptes créés :');
  console.log('   admin@visionode.local   / Admin@2024!   (rôle: admin)');
  console.log('   chef@visionode.local    / Chef@2024!    (rôle: chef-de-bloc)');
  console.log('   user@visionode.local    / User@2024!    (rôle: user, en attente)');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seed :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
