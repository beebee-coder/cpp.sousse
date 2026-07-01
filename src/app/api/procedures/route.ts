import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/db/prisma-client';
import { procedureRAG } from '@/lib/procedures/services/rag.service';
import { postgresClient } from '@/lib/db/postgres-client';
import { getSessionFromCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/procedures
 * Liste et amorçage automatique synchronisé avec le registre physique.
 */
export async function GET() {
  try {
    let procedures = await prisma.procedure.findMany({
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { firstName: true, lastName: true } } }
    });

    // AMORÇAGE AUTOMATIQUE : Si vide, on injecte la vraie procédure CRF depuis data/
    if (procedures.length === 0) {
      try {
        const dataPath = path.join(process.cwd(), 'data', 'procedure-demarrage-CRF.json');
        if (require('fs').existsSync(dataPath)) {
          const fileContent = await fs.readFile(dataPath, 'utf8');
          const realProc = JSON.parse(fileContent);

          // Identification de l'auteur système
          let author = await prisma.user.findFirst({ where: { role: 'admin' } });
          const authorId = author?.id || 'admin-root';

          const created = await prisma.procedure.upsert({
            where: { code: realProc.metadata.code },
            update: {
              steps: realProc.steps,
              prerequisites: realProc.prerequisites,
              metadata: realProc.metadata,
            },
            create: {
              id: realProc._id || `proc-crf-${Date.now()}`,
              code: realProc.metadata.code,
              title: realProc.metadata.title,
              description: realProc.metadata.subcategory || realProc.metadata.description || 'Procédure critique.',
              category: (realProc.metadata.category || 'OPERATION').toUpperCase(),
              department: (realProc.metadata.department || 'PRODUCTION').toUpperCase(),
              criticality: (realProc.metadata.criticality || 'MEDIUM').toUpperCase(),
              version: realProc.metadata.version || "1.0.0",
              status: 'APPROVED',
              prerequisites: realProc.prerequisites || { items: [] },
              steps: realProc.steps || [],
              metadata: { ...realProc.metadata, authorId },
              parameters: realProc.parameters || {},
              postExecution: realProc.postExecution || {},
              authorId: authorId,
            }
          });

          // Archivage Physique Immédiat
          const registryPath = `procedures/${created.code.toLowerCase()}/procedure.json`;
          await postgresClient.saveFile(registryPath, JSON.stringify(created, null, 2));
          
          // Vectorisation asynchrone
          procedureRAG.indexProcedure(created as any).catch(e => console.warn("RAG_SEED_SKIP:", e.message));
          
          procedures = [created as any];
        }
      } catch (seedErr: any) {
        console.error('[PROCEDURE_API] Échec amorçage critique:', seedErr.message);
      }
    }

    return NextResponse.json({ success: true, procedures });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'Erreur lecture registre.', error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/procedures
 * Forge de procédure atomique : DB Web + Registre Physique + Indexation RAG.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    const body = await request.json();
    const { title, steps, metadata, prerequisites, parameters, postExecution } = body;

    if (!title || !steps || !Array.isArray(steps)) {
      return NextResponse.json({ success: false, message: 'Structure de forge invalide.' }, { status: 400 });
    }

    // 1. Identification de l'auteur (Crucial pour Prisma FK)
    let authorId = session?.user?.id;
    
    if (!authorId) {
      const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
      authorId = admin?.id || 'admin-root'; // Fallback ultime sur l'ID par défaut
    }

    const code = metadata?.code || `FORGE-${Date.now().toString().slice(-6)}`;

    // 2. Enregistrement Base de Données Cloud (Neon)
    const procedure = await prisma.procedure.create({
      data: {
        code,
        title: title.trim(),
        description: body.description || metadata?.description || 'Procédure forgée via Dictée.',
        category: (metadata?.category || 'OPERATION').toUpperCase(),
        department: (metadata?.department || 'PRODUCTION').toUpperCase(),
        criticality: (metadata?.criticality || 'MEDIUM').toUpperCase(),
        version: metadata?.version || '1.0.0',
        status: 'APPROVED',
        prerequisites: prerequisites || { description: "Pris-requis de sécurité", items: [] },
        steps: steps,
        metadata: { ...metadata, authorId, createdAt: new Date().toISOString() },
        parameters: parameters || { variables: [] },
        postExecution: postExecution || { checks: [], reporting: { generateReport: true, reportFields: [] } },
        authorId: authorId,
        syncedLocal: false
      }
    });

    // 3. Archivage Registre Physique (Garantit la sync Desktop)
    try {
      const registryPath = `procedures/${procedure.code.toLowerCase()}/procedure.json`;
      await postgresClient.saveFile(registryPath, JSON.stringify(procedure, null, 2));

      // Projection sémantique simplifiée pour le fallback offline
      const projection = {
        id: procedure.id,
        projectId: 'global',
        type: 'procedure',
        content: JSON.stringify({
          title: procedure.title,
          label: procedure.code,
          details: procedure.description,
          procedureId: procedure.id
        }),
        tags: [procedure.category, procedure.code],
        createdAt: new Date()
      };
      await postgresClient.upsertCloudData([projection]);
    } catch (fsErr: any) {
      console.warn(`⚠️ [REGISTRY_WRITE_FAIL] ${fsErr.message}`);
    }

    // 4. Vectorisation RAG (Fire and Forget)
    procedureRAG.indexProcedure(procedure as any).catch(ragErr => {
      console.error(`⚠️ [RAG_FAIL] Indexation vectorielle différée: ${ragErr.message}`);
    });

    return NextResponse.json({
      success: true,
      procedureId: procedure.id,
      message: `Procédure "${procedure.title}" forgée et indexée.`
    });

  } catch (error: any) {
    console.error('[API_PROCEDURES_POST] Échec critique:', error.message);
    return NextResponse.json(
      { success: false, message: 'Échec de la forge.', error: error.message },
      { status: 500 }
    );
  }
}
