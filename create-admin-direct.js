// create-admin-direct.js
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Charger .env.local
dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
console.log('📡 DATABASE_URL:', connectionString ? '✅ Définie' : '❌ Non définie');

if (!connectionString) {
  console.error('❌ DATABASE_URL non définie');
  process.exit(1);
}

// Nettoyer la connexion (enlever les guillemets si présents)
const cleanConnectionString = connectionString.replace(/^"|"$/g, '');
console.log('📡 Connexion nettoyée:', cleanConnectionString.substring(0, 50) + '...');

// Créer le client Neon
const sql = neon(cleanConnectionString);

async function main() {
  try {
    console.log('🔧 Test de connexion directe...');
    
    // Tester la connexion
    const testResult = await sql`SELECT 1 as connected, NOW() as time, version() as version`;
    console.log('✅ Connexion réussie!');
    console.log('   Version PostgreSQL:', testResult[0]?.version?.substring(0, 50) + '...');
    
    // Vérifier les tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log('📊 Tables trouvées:', tables.map(t => t.table_name).join(', '));

    // Générer le hash
    const hashedPassword = await bcrypt.hash('admin123', 10);
    console.log('✅ Hash généré');

    // Vérifier si l'admin existe
    const existing = await sql`
      SELECT * FROM users WHERE email = 'admin@visionode.local'
    `;

    let result;
    if (existing.length > 0) {
      console.log('✅ Admin existe déjà, mise à jour...');
      result = await sql`
        UPDATE users 
        SET password = ${hashedPassword}, 
            approved = true, 
            role = 'admin',
            "firstName" = 'Ahmed',
            "lastName" = 'Admin',
            "updatedAt" = NOW()
        WHERE email = 'admin@visionode.local'
        RETURNING *
      `;
      console.log('✅ Admin mis à jour');
    } else {
      console.log('📝 Création de l\'admin...');
      result = await sql`
        INSERT INTO users (
          id, email, "firstName", "lastName", password, role, approved, "createdAt", "updatedAt"
        ) VALUES (
          ${'admin-' + Date.now()},
          'admin@visionode.local',
          'Ahmed',
          'Admin',
          ${hashedPassword},
          'admin',
          true,
          NOW(),
          NOW()
        )
        RETURNING *
      `;
      console.log('✅ Admin créé');
    }

    // Afficher les résultats
    const admin = result[0];
    console.log('\n📊 Admin créé/mis à jour:');
    console.log('   🆔 ID:', admin.id);
    console.log('   📧 Email:', admin.email);
    console.log('   👤 Nom:', admin.firstName, admin.lastName);
    console.log('   🔑 Rôle:', admin.role);
    console.log('   ✅ Approuvé:', admin.approved);
    
    console.log('\n🔐 Identifiants de connexion:');
    console.log('   Email: admin@visionode.local');
    console.log('   Mot de passe: admin123');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error('📄 Stack:', error.stack);
  }
}

main();
