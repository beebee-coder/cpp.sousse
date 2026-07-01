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
      orderBy: { createdAt: 'desc' }
    });

    // AMORÇAGE AUTOMATIQUE : Si vide, on injecte la vraie procédure CRF
    if (procedures.length === 0) {
      try {
        const dataPath = path.join(process.cwd(), 'data', 'procedure-demarrage-CRF.json');
        const fileContent = await fs.readFile(dataPath, 'utf8');
        const realProc = JSON.parse(fileContent);

        // S'assurer que l'auteur admin existe
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
            prerequisites: realProc.prerequisites as any,
            steps: realProc.steps as any,
            metadata: realProc.metadata as any,
            parameters: realProc.parameters as any,
            postExecution: realProc.postExecution as any,
            authorId: authorId,
          }
        });

        // 2. Création Registre Physique (Archivage conforme)
        const dirName = `${created.code.toLowerCase()}_master`;
        const registryBase = path.join(process.cwd(), '.registry', 'procedures', dirName);
        await fs.mkdir(registryBase, { recursive: true });
        await fs.writeFile(
          path.join(registryBase, 'procedure.json'),
          JSON.stringify(created, null, 2),
          'utf8'
        );
        
        // 3. Vectorisation obligatoire
        await procedureRAG.indexProcedure(created as any);
        
        procedures = [created];
      } catch (seedErr: any) {
        console.warn('[PROCEDURE_API] Échec amorçage critique CRF:', seedErr.message);
      }
    }

    return NextResponse.json({ success: true, procedures });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'Erreur lecture registre.' }, { status: 500 });
  }
}

/**
 * POST /api/procedures
 * Création avec Vectorisation et Archivage Physique.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, steps, metadata } = body;

    if (!title) {
      return NextResponse.json({ success: false, message: 'Titre requis.' }, { status: 400 });
    }

    // S'assurer que l'auteur existe
    const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
    const authorId = admin?.id || 'admin-root';

    const code = metadata?.code || `PROC-${Date.now().toString().slice(-6)}`;

    // 1. Création Database (Prisma)
    const procedure = await prisma.procedure.create({
      data: {
        code,
        title,
        description: body.description || '',
        category: (metadata?.category || 'OPERATION').toUpperCase() as any,
        department: (metadata?.department || 'PRODUCTION').toUpperCase() as any,
        criticality: (metadata?.criticality || 'MEDIUM').toUpperCase() as any,
        version: metadata?.version || '1.0.0',
        status: 'APPROVED',
        prerequisites: body.prerequisites || { items: [] },
        steps: steps || [],
        metadata: { ...metadata, createdAt: new Date().toISOString() } as any,
        parameters: body.parameters || { variables: [] },
        postExecution: body.postExecution || { checks: [] },
        authorId: authorId,
      }
    });

    // 2. Archivage Physique (Registre)
    const dirName = `${procedure.code.toLowerCase()}_${Date.now()}`;
    const registryBase = path.join(process.cwd(), '.registry', 'procedures', dirName);
    await fs.mkdir(registryBase, { recursive: true });
    await fs.writeFile(
      path.join(registryBase, 'procedure.json'),
      JSON.stringify(procedure, null, 2),
      'utf8'
    );

    // 3. Vectorisation OBLIGATOIRE (Non-bloquante pour la réponse client si timeout)
    try {
      await procedureRAG.indexProcedure(procedure as any);
    } catch (ragErr: any) {
      console.error(`⚠️ [RAG_FAIL] ${ragErr.message}`);
    }

    return NextResponse.json({
      success: true,
      procedureId: procedure.id,
      message: `Procédure forgée et indexée avec succès.`
    });

  } catch (error: any) {
    console.error('[API_PROCEDURES_POST]', error);
    return NextResponse.json(
      { success: false, message: 'Échec de la forge.', error: error.message },
      { status: 500 }
    );
  }
}
