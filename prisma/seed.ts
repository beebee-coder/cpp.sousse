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

      // ── Champs de configuration (Attributs Personnalisés) par défaut ──────
      // Permet une expérience immédiate et cohérente web ↔ offline.
      const DEFAULT_CONFIG_FIELDS = [
        { name: 'Pression de consigne', type: 'number', description: 'Pression cible en bar', required: true },
        { name: 'Température', type: 'number', description: 'Température mesurée en °C', required: false },
        { name: 'État vanne', type: 'select', description: 'Position de la vanne', required: false, options: ['Ouvert', 'Fermé', 'Maintenance'] },
        { name: 'Validation opérateur', type: 'boolean', description: 'Confirmaction manuelle requise', required: false },
        { name: 'Observation', type: 'text', description: 'Note libre de l\'opérateur', required: false },
      ];

      for (const f of DEFAULT_CONFIG_FIELDS) {
        const id = `seed-cf-${f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        await tx.procedureFieldTemplate.upsert({
          where: { id },
          update: {
            name: f.name,
            type: f.type,
            description: f.description ?? null,
            options: (f as any).options ?? null,
            required: f.required,
          },
          create: {
            id,
            name: f.name,
            type: f.type,
            description: f.description ?? null,
            options: (f as any).options ?? null,
            required: f.required,
          },
        });
      }
      console.log(`✅ [SEED] ${DEFAULT_CONFIG_FIELDS.length} champ(s) de configuration par défaut créé(s).`);

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

      // R1 — Aligné sur la racine Rust via REGISTRY_ROOT_OVERRIDE (Desktop).
      const REGISTRY_OVERRIDE = process.env.REGISTRY_ROOT_OVERRIDE?.trim();
      const REGISTRY_ROOT = REGISTRY_OVERRIDE ? REGISTRY_OVERRIDE : path.join(process.cwd(), '.registry');
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
