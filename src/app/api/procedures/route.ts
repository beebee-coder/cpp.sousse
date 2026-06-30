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

        // 1. Création Database (Prisma)
        const created = await prisma.procedure.create({
          data: {
            id: realProc._id || `proc-crf-${Date.now()}`,
            code: realProc.metadata.code,
            title: realProc.metadata.title,
            description: realProc.metadata.subcategory || realProc.metadata.description || '',
            category: (realProc.metadata.category || 'OPERATION').toUpperCase() as any,
            department: (realProc.metadata.department || 'PRODUCTION').toUpperCase() as any,
            criticality: (realProc.metadata.criticality || 'MEDIUM').toUpperCase() as any,
            version: realProc.metadata.version,
            status: 'APPROVED',
            prerequisites: realProc.prerequisites as any,
            steps: realProc.steps as any,
            metadata: realProc.metadata as any,
            parameters: realProc.parameters as any,
            postExecution: realProc.postExecution as any,
            authorId: 'admin-root',
          }
        });

        // 2. Création Registre Physique (Archivage conforme)
        const dirName = `${created.code.toLowerCase()}_master`;
        const registryBase = path.join(process.cwd(), '.registry', 'procedures', dirName);
        await fs.mkdir(registryBase, { recursive: true });
        await fs.writeFile(
          path.join(registryBase, 'procedure.json'),
          JSON.stringify({ ...created, registryDir: dirName }, null, 2),
          'utf8'
        );
        
        // 3. Vectorisation obligatoire
        await procedureRAG.indexProcedure(created as any);
        
        procedures = [created];
        console.log(`✅ [PROCEDURE_SEED] Amorçage réussi : ${created.code} synchronisé dans le registre.`);
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
    const { title, steps, metadata, prerequisites, parameters, postExecution } = body;

    if (!title) {
      return NextResponse.json({ success: false, message: 'Titre requis.' }, { status: 400 });
    }

    // 1. Création Database (Prisma)
    const procedure = await prisma.procedure.create({
      data: {
        code: metadata?.code || `PROC-${Date.now().toString().slice(-6)}`,
        title,
        description: body.description || '',
        category: (metadata?.category || 'OPERATION').toUpperCase() as any,
        department: (metadata?.department || 'PRODUCTION').toUpperCase() as any,
        criticality: (metadata?.criticality || 'MEDIUM').toUpperCase() as any,
        version: metadata?.version || '1.0.0',
        status: 'APPROVED',
        prerequisites: prerequisites || {},
        steps: steps || [],
        metadata: metadata || {},
        parameters: parameters || {},
        postExecution: postExecution || {},
        authorId: 'admin-root',
      }
    });

    // 2. Vectorisation OBLIGATOIRE
    try {
      await procedureRAG.indexProcedure(procedure as any);
    } catch (ragErr: any) {
      console.error(`⚠️ [CRITICAL] Vectorisation en échec: ${ragErr.message}`);
    }

    // 3. Archivage Physique (Registre)
    const dirName = `${procedure.code.toLowerCase()}_${Date.now()}`;
    const registryBase = path.join(process.cwd(), '.registry', 'procedures', dirName);
    await fs.mkdir(registryBase, { recursive: true });
    await fs.writeFile(
      path.join(registryBase, 'procedure.json'),
      JSON.stringify({ ...procedure, registryDir: dirName }, null, 2),
      'utf8'
    );

    return NextResponse.json({
      success: true,
      procedureId: procedure.id,
      message: `Procédure vectorisée et archivée dans le registre physique.`
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'Échec de la forge.', error: error.message },
      { status: 500 }
    );
  }
}
