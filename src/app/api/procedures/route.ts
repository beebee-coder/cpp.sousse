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

    // AMORÇAGE AUTOMATIQUE : Si vide, on injecte la vraie procédure CRF
    if (procedures.length === 0) {
      try {
        const dataPath = path.join(process.cwd(), 'data', 'procedure-demarrage-CRF.json');
        if (require('fs').existsSync(dataPath)) {
          const fileContent = await fs.readFile(dataPath, 'utf8');
          const realProc = JSON.parse(fileContent);

          const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
          const authorId = admin?.id || 'admin-root';

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
              description: realProc.metadata.subcategory || realProc.metadata.description || '',
              category: (realProc.metadata.category || 'OPERATION').toUpperCase() as any,
              department: (realProc.metadata.department || 'PRODUCTION').toUpperCase() as any,
              criticality: (realProc.metadata.criticality || 'MEDIUM').toUpperCase() as any,
              version: realProc.metadata.version,
              status: 'APPROVED',
              prerequisites: realProc.prerequisites,
              steps: realProc.steps,
              metadata: realProc.metadata,
              parameters: realProc.parameters || {},
              postExecution: realProc.postExecution || {},
              authorId: authorId,
            }
          });

          // Archivage Physique via postgresClient
          const registryPath = `procedures/${created.code.toLowerCase()}/procedure.json`;
          await postgresClient.saveFile(registryPath, JSON.stringify(created, null, 2));
          
          await procedureRAG.indexProcedure(created as any);
          procedures = [created as any];
        }
      } catch (seedErr: any) {
        console.warn('[PROCEDURE_API] Échec amorçage critique:', seedErr.message);
      }
    }

    return NextResponse.json({ success: true, procedures });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'Erreur lecture registre.' }, { status: 500 });
  }
}

/**
 * POST /api/procedures
 * Forge de procédure : DB Web + Registre Physique + Indexation RAG.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    const body = await request.json();
    const { title, steps, metadata, prerequisites, parameters, postExecution } = body;

    if (!title || !steps) {
      return NextResponse.json({ success: false, message: 'Données incomplètes pour la forge.' }, { status: 400 });
    }

    // Récupérer l'auteur depuis la session ou utiliser l'admin root par défaut
    let authorId = session?.user?.id;
    if (!authorId) {
      const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
      authorId = admin?.id || 'admin-root';
    }

    const code = metadata?.code || `PROC-${Date.now().toString().slice(-6)}`;

    // 1. Enregistrement Base de Données Cloud (Neon)
    const procedure = await prisma.procedure.create({
      data: {
        code,
        title,
        description: body.description || metadata?.description || '',
        category: (metadata?.category || 'OPERATION').toUpperCase() as any,
        department: (metadata?.department || 'PRODUCTION').toUpperCase() as any,
        criticality: (metadata?.criticality || 'MEDIUM').toUpperCase() as any,
        version: metadata?.version || '1.0.0',
        status: 'APPROVED',
        prerequisites: prerequisites || { description: "Prérequis de sécurité", items: [] },
        steps: steps,
        metadata: { ...metadata, authorId, createdAt: new Date().toISOString() },
        parameters: parameters || { variables: [] },
        postExecution: postExecution || { checks: [], reporting: { generateReport: true, reportFields: [] } },
        authorId: authorId,
        syncedLocal: false
      }
    });

    // 2. Archivage Registre Physique via postgresClient
    try {
      const registryPath = `procedures/${procedure.code.toLowerCase()}/procedure.json`;
      await postgresClient.saveFile(registryPath, JSON.stringify(procedure, null, 2));

      // 3. Projection sémantique pour recherche fallback
      await postgresClient.upsertCloudData([{
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
      }]);
    } catch (fsErr: any) {
      console.warn(`⚠️ [REGISTRY_WRITE_FAIL] ${fsErr.message}`);
    }

    // 4. Vectorisation Immédiate (Moteur de recherche IA)
    try {
      await procedureRAG.indexProcedure(procedure as any);
    } catch (ragErr: any) {
      console.error(`⚠️ [RAG_FAIL] ${ragErr.message}`);
    }

    return NextResponse.json({
      success: true,
      procedureId: procedure.id,
      message: `Procédure forgée avec succès et enregistrée dans la BDD Web.`
    });

  } catch (error: any) {
    console.error('[API_PROCEDURES_POST]', error);
    return NextResponse.json(
      { success: false, message: 'Échec de la forge.', error: error.message },
      { status: 500 }
    );
  }
}
