import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/db/prisma-client';
import { procedureRAG } from '@/lib/procedures/services/rag.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/procedures
 * Liste toutes les procédures depuis la base de données Prisma.
 */
export async function GET() {
  try {
    const procedures = await prisma.procedure.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ success: true, procedures });
  } catch (error: any) {
    console.error('[PROCEDURE_API] GET Error:', error.message);
    return NextResponse.json({ success: false, message: 'Erreur lecture base de données.' }, { status: 500 });
  }
}

/**
 * POST /api/procedures
 * Sauvegarde d'une procédure industrielle complète.
 * Enregistre dans Prisma (DB) + FS (Registre) + Indexation RAG.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, steps, metadata } = body;

    if (!title) {
      return NextResponse.json({ success: false, message: 'Titre de procédure requis.' }, { status: 400 });
    }

    // 1. Sauvegarde dans Prisma
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
        authorId: 'admin-root', // Par défaut pour le POC
      }
    });

    // 2. Sauvegarde Physique dans .registry pour la banque de fichiers
    const slug = procedure.code.toLowerCase();
    const dirName = `${slug}_${Date.now()}`;
    const registryBase = path.join(process.cwd(), '.registry', 'procedures', dirName);
    await fs.mkdir(registryBase, { recursive: true });
    await fs.writeFile(
      path.join(registryBase, 'procedure.json'),
      JSON.stringify({ ...procedure, registryDir: dirName }, null, 2),
      'utf8'
    );

    // 3. Indexation RAG (Asynchrone)
    procedureRAG.indexProcedure(procedure as any).catch(err => {
      console.warn('[RAG_INDEX_SKIP] Erreur indexation procédure:', err.message);
    });

    console.log(`[PROCEDURE_API] ✅ Procédure ${procedure.code} créée et indexée.`);

    return NextResponse.json({
      success: true,
      procedureId: procedure.id,
      message: `Procédure "${title}" enregistrée et prête.`
    });

  } catch (error: any) {
    console.error('[PROCEDURE_API] POST Error:', error.message);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de l\'enregistrement.', error: error.message },
      { status: 500 }
    );
  }
}
