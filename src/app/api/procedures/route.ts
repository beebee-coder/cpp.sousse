import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/db/prisma-client';
import { procedureRAG } from '@/lib/procedures/services/rag.service';

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
            category: (realProc.metadata.category || 'OPERATION').toUpperCase(),
            department: (realProc.metadata.department || 'PRODUCTION').toUpperCase(),
            criticality: (realProc.metadata.criticality || 'MEDIUM').toUpperCase(),
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

        // Archivage Physique pour Sync
        const registryBase = path.join(process.cwd(), '.registry', 'procedures', created.code.toLowerCase());
        await fs.mkdir(registryBase, { recursive: true });
        await fs.writeFile(
          path.join(registryBase, 'procedure.json'),
          JSON.stringify(created, null, 2),
          'utf8'
        );
        
        await procedureRAG.indexProcedure(created as any);
        procedures = [created as any];
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
    const body = await request.json();
    const { title, steps, metadata, prerequisites, parameters, postExecution } = body;

    if (!title || !steps) {
      return NextResponse.json({ success: false, message: 'Données incomplètes pour la forge.' }, { status: 400 });
    }

    const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
    const authorId = admin?.id || 'admin-root';
    const code = metadata?.code || `PROC-${Date.now().toString().slice(-6)}`;

    // 1. Enregistrement Base de Données Cloud (Neon)
    const procedure = await prisma.procedure.create({
      data: {
        code,
        title,
        description: body.description || metadata?.description || '',
        category: (metadata?.category || 'OPERATION').toUpperCase(),
        department: (metadata?.department || 'PRODUCTION').toUpperCase(),
        criticality: (metadata?.criticality || 'MEDIUM').toUpperCase(),
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

    // 2. Archivage Registre Physique (Attente de Sync)
    const dirName = procedure.code.toLowerCase();
    const registryBase = path.join(process.cwd(), '.registry', 'procedures', dirName);
    await fs.mkdir(registryBase, { recursive: true });
    await fs.writeFile(
      path.join(registryBase, 'procedure.json'),
      JSON.stringify(procedure, null, 2),
      'utf8'
    );

    // 3. Vectorisation Immédiate (Moteur de recherche IA)
    try {
      await procedureRAG.indexProcedure(procedure as any);
    } catch (ragErr: any) {
      console.error(`⚠️ [RAG_FAIL] ${ragErr.message}`);
    }

    return NextResponse.json({
      success: true,
      procedureId: procedure.id,
      message: `Procédure forgée et archivée dans le registre physique.`
    });

  } catch (error: any) {
    console.error('[API_PROCEDURES_POST]', error);
    return NextResponse.json(
      { success: false, message: 'Échec de la forge.', error: error.message },
      { status: 500 }
    );
  }
}
