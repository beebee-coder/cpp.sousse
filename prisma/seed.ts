import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import bcrypt from 'bcryptjs';
import { getPrismaClient, disconnectPrisma } from '../src/lib/db/prisma-client';

function walkRegistry(dir: string, base = ''): { json: string[]; nonJson: number } {
  if (!fs.existsSync(dir)) return { json: [], nonJson: 0 };
  const out: string[] = [];
  let nonJson = 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      const sub = walkRegistry(path.join(dir, ent.name), rel);
      out.push(...sub.json);
      nonJson += sub.nonJson;
    } else if (ent.name.toLowerCase().endsWith('.json')) {
      out.push(rel);
    } else {
      nonJson++;
    }
  }
  return { json: out, nonJson };
}

async function main() {
  const ts = new Date().toLocaleTimeString();
  console.log(`🌱 [${ts}] [SEED] Initialisation du Registre.`);

  const prisma = await getPrismaClient();
  const hashedAdminPassword = await bcrypt.hash('admin123', 12);

  try {
    await prisma.$transaction(async tx => {
      console.log("👤 [SEED] Audit de l'administrateur root...");
      const admin = await tx.user.upsert({
        where: { email: 'admin@visionode.local' },
        update: {
          password: hashedAdminPassword,
          approved: true,
          role: 'admin',
          firstName: 'Ahmed',
          lastName: 'Admin',
          updatedAt: new Date()
        },
        create: {
          id: 'admin-root-001',
          email: 'admin@visionode.local',
          firstName: 'Ahmed',
          lastName: 'Admin',
          password: hashedAdminPassword,
          role: 'admin',
          approved: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      console.log(`✅ [SEED] Admin configuré : ${admin.email}`);

      const baseKnowledge = [
        {
          id: 'seed-k-epi-crf',
          title: 'Sécurité CRF - EPI Obligatoires',
          type: 'qa',
          question: 'Quels sont les EPI obligatoires en zone CRF ?',
          answer: 'Casque de sécurité, gants anti-coupure, lunettes de protection S3, chaussures de sécurité.',
          tags: ['EPI', 'Sécurité', 'CRF'],
          category: 'Sécurité'
        }
      ];

      for (const item of baseKnowledge) {
        await tx.knowledgeItem.upsert({
          where: { id: item.id },
          update: item,
          create: { ...item, userId: admin.id }
        });
      }

      const REGISTRY_ROOT = path.join(process.cwd(), '.registry');
      const { json: registryFiles, nonJson } = walkRegistry(REGISTRY_ROOT);
      console.log(`📂 [SEED] ${registryFiles.length} fichier(s) JSON détecté(s) dans .registry.`);
      if (nonJson > 0) {
        console.log(`ℹ️ [SEED] ${nonJson} fichier(s) non-JSON ignoré(s) dans .registry.`);
      }

      let ingested = 0;
      for (const rel of registryFiles) {
        const abs = path.join(REGISTRY_ROOT, rel);
        let raw = '';
        try {
          raw = fs.readFileSync(abs, 'utf8');
        } catch {
          continue;
        }

        let parsed: any = null;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }

        const relNoExt = rel.replace(/\.json$/i, '');
        const segments = relNoExt.split('/').filter(Boolean);
        const topFolder = segments[0] || 'items';
        const fileName = segments[segments.length - 1];
        const title = (parsed && (parsed.title || parsed.name)) || fileName;
        const type = parsed?.type || (topFolder === 'items' ? 'qa' : 'document');
        const safeId = `reg-${relNoExt.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const question = type === 'qa' ? (parsed?.question || parsed?.pairs?.[0]?.question || null) : null;
        const answer = type === 'qa' ? (parsed?.answer || parsed?.pairs?.map((p: any) => p.answer).filter(Boolean).join('\n\n') || null) : null;

        await tx.knowledgeItem.upsert({
          where: { id: safeId },
          update: {
            title,
            type,
            content: raw,
            question,
            answer,
            tags: ['registry', `regpath:${rel}`],
            category: topFolder
          },
          create: {
            id: safeId,
            userId: admin.id,
            title,
            type,
            content: raw,
            question,
            answer,
            tags: ['registry', `regpath:${rel}`],
            category: topFolder
          }
        });
        ingested++;
      }

      console.log(`✅ [SEED] ${ingested} élément(s) du Registre synchronisé(s) vers knowledge_items.`);
      console.log('✅ [SEED] Registre initialisé avec succès.');
    });
  } catch (err: any) {
    console.error('❌ [SEED] Échec critique :', err.message);
    process.exit(1);
  } finally {
    await disconnectPrisma();
  }
}

main();
