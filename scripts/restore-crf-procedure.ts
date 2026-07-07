// scripts/restore-crf-procedure.ts
// Restaure la procédure "Démarrage de la pompe CRF" (CRF-START-001)
// supprimée accidentellement. Réplique le chemin de la Station de Forge
// (src/app/api/procedures/route.ts) : archivage Registre Physique + liaison SQL Neon.

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  const { prisma } = await import('../src/lib/db/prisma-client');
  const ts = new Date().toLocaleTimeString();

  const src = path.resolve(process.cwd(), 'data/procedure-demarrage-CRF.json');
  if (!fs.existsSync(src)) {
    console.error('❌ Fichier source introuvable :', src);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(src, 'utf8'));

  const title = data.metadata?.title || 'Démarrage de la pompe CRF';
  const metadata = data.metadata || {};
  const code = (metadata.code || 'CRF-START-001').toUpperCase();

  // Reconstruction identique à la route de forge
  const procedureData = {
    _id: data._id || `proc-${code.toLowerCase()}`,
    _version: metadata.version || '1.0.0',
    _type: 'industrial_procedure',
    metadata: {
      ...metadata,
      title,
      code,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    },
    prerequisites: data.prerequisites || { description: 'Audit standard', items: [] },
    steps: (data.steps || []).map((s: any, i: number) => ({ ...s, order: i + 1 })),
    postExecution: data.postExecution || {},
    parameters: data.parameters || {},
    _restored_by: 'restore-script',
  };

  // 1. Archivage Registre Physique
  const regPath = path.join(process.cwd(), '.registry', 'procedures', code.toLowerCase(), 'procedure.json');
  fs.mkdirSync(path.dirname(regPath), { recursive: true });
  fs.writeFileSync(regPath, JSON.stringify(procedureData, null, 2), 'utf8');
  console.log(`📂 [REGISTRY] Fichier restauré : ${regPath}`);

  // 2. Liaison SQL Neon (idempotent via upsert sur code unique)
  let authorId = 'admin-root-001';
  try {
    const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
    if (admin?.id) authorId = admin.id;
  } catch { /* ignore */ }

  const existing = await prisma.procedure.findUnique({ where: { code } });
  const description = `Procédure de démarrage de la pompe CRF du système de réfrigération principal.`;

  if (existing) {
    await prisma.procedure.update({
      where: { code },
      data: {
        title,
        description,
        category: (metadata.category || 'OPERATION').toUpperCase(),
        criticality: (metadata.criticality || 'MEDIUM').toUpperCase(),
        steps: procedureData.steps as any,
        prerequisites: procedureData.prerequisites as any,
        updatedAt: new Date(),
      },
    });
    console.log(`🔄 [FORGE] Procédure mise à jour : ${code}`);
  } else {
    await prisma.procedure.create({
      data: {
        id: procedureData._id,
        code,
        title,
        description,
        category: (metadata.category || 'OPERATION').toUpperCase(),
        criticality: (metadata.criticality || 'MEDIUM').toUpperCase(),
        status: 'APPROVED',
        prerequisites: procedureData.prerequisites as any,
        steps: procedureData.steps as any,
        authorId,
      },
    });
    console.log(`✅ [FORGE] Procédure recréée : ${code}`);
  }

  const count = await prisma.procedure.count();
  console.log(`📊 [FORGE] Total procédures en base : ${count}`);
  await prisma.$disconnect();
  console.log(`🏁 [${ts}] Restauration terminée.`);
}

main().catch((err) => {
  console.error('❌ Échec restauration :', err);
  process.exit(1);
});
