import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/db/prisma-client';
import { procedureRAG } from '@/lib/procedures/services/rag.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/procedures
 * Liste toutes les procédures. 
 * Si aucune n'existe, amorce le système avec la procédure CRF réelle.
 */
export async function GET() {
  try {
    let procedures = await prisma.procedure.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Amorçage automatique avec la procédure réelle si vide
    if (procedures.length === 0) {
      try {
        const filePath = path.join(process.cwd(), 'data', 'procedure-demarrage-CRF.json');
        const fileContent = await fs.readFile(filePath, 'utf8');
        const realProc = JSON.parse(fileContent);

        const created = await prisma.procedure.create({
          data: {
            id: realProc._id || `proc-crf-${Date.now()}`,
            code: realProc.metadata.code,
            title: realProc.metadata.title,
            description: realProc.metadata.subcategory || '',
            category: realProc.metadata.category.toUpperCase() as any,
            department: realProc.metadata.department.toUpperCase() as any,
            criticality: realProc.metadata.criticality.toUpperCase() as any,
            version: realProc.metadata.version,
            status: 'APPROVED',
            prerequisites: realProc.prerequisites as any,
            steps: realProc.steps as any,
            metadata: realProc.metadata as any,
            authorId: 'admin-root',
          }
        });
        procedures = [created];
      } catch (seedErr) {
        console.warn('[PROCEDURE_API] Échec de l\'amorçage CRF:', seedErr);
      }
    }

    return NextResponse.json({ success: true, procedures });
  } catch (error: any) {
    console.error('[PROCEDURE_API] GET Error:', error.message);
    return NextResponse.json({ success: false, message: 'Erreur lecture base de données.' }, { status: 500 });
  }
}

/**
 * POST /api/procedures
 * Sauvegarde d'une procédure industrielle réelle.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, steps, metadata } = body;

    if (!title) {
      return NextResponse.json({ success: false, message: 'Titre de procédure requis.' }, { status: 400 });
    }

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
        prerequisites: body.prerequisites || {},
        steps: steps || [],
        metadata: metadata || {},
        authorId: 'admin-root',
      }
    });

    const slug = procedure.code.toLowerCase();
    const dirName = `${slug}_${Date.now()}`;
    const registryBase = path.join(process.cwd(), '.registry', 'procedures', dirName);
    await fs.mkdir(registryBase, { recursive: true });
    await fs.writeFile(
      path.join(registryBase, 'procedure.json'),
      JSON.stringify({ ...procedure, registryDir: dirName }, null, 2),
      'utf8'
    );

    procedureRAG.indexProcedure(procedure as any).catch(err => {
      console.warn('[RAG_INDEX_SKIP] Erreur indexation procédure:', err.message);
    });

    return NextResponse.json({
      success: true,
      procedureId: procedure.id,
      message: `Procédure "${title}" enregistrée.`
    });

  } catch (error: any) {
    console.error('[PROCEDURE_API] POST Error:', error.message);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de l\'enregistrement.', error: error.message },
      { status: 500 }
    );
  }
}
