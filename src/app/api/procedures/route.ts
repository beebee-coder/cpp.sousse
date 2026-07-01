import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { procedureRAG } from '@/lib/procedures/services/rag.service';
import { postgresClient } from '@/lib/db/postgres-client';
import { getSessionFromCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/procedures
 * Liste les procédures et initialise la procédure CRF si nécessaire.
 */
export async function GET() {
  try {
    let procedures = await prisma.procedure.findMany({
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { firstName: true, lastName: true } } }
    });

    return NextResponse.json({ success: true, procedures });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'Erreur lecture registre.', error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/procedures
 * Forge de procédure robuste avec gestion résiliente des auteurs.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    const body = await request.json();
    const { title, steps, metadata } = body;

    if (!title || !steps || !Array.isArray(steps)) {
      return NextResponse.json({ success: false, message: 'Structure de forge invalide : Titre et Étapes requis.' }, { status: 400 });
    }

    // 1. Identification de l'auteur (Crucial pour Prisma)
    let authorId = session?.user?.id;
    
    if (!authorId) {
      // Fallback : On cherche un administrateur système ou le premier utilisateur
      const admin = await prisma.user.findFirst({ 
        where: { role: { in: ['admin', 'chef-de-bloc'] } } 
      });
      authorId = admin?.id || 'admin-root'; 
    }

    const code = metadata?.code || `FORGE-${Date.now().toString().slice(-6)}`;

    // 2. Enregistrement Base de Données Web (Neon)
    const procedure = await prisma.procedure.create({
      data: {
        code,
        title: title.trim(),
        description: body.description || metadata?.description || 'Procédure générée via Station de Dictée.',
        category: (metadata?.category || 'OPERATION').toUpperCase(),
        department: (metadata?.department || 'PRODUCTION').toUpperCase(),
        criticality: (metadata?.criticality || 'MEDIUM').toUpperCase(),
        version: metadata?.version || '1.0.0',
        status: 'APPROVED',
        prerequisites: body.prerequisites || { description: "Conditions de sécurité standards", items: [] },
        steps: steps,
        metadata: { ...metadata, authorId, forged_at: new Date().toISOString() },
        parameters: body.parameters || { variables: [] },
        postExecution: body.postExecution || { checks: [], reporting: { generateReport: true, reportFields: [] } },
        authorId: authorId,
        syncedLocal: false
      }
    });

    // 3. Archivage Physique (Registre)
    try {
      const registryPath = `procedures/${procedure.code.toLowerCase()}/procedure.json`;
      await postgresClient.saveFile(registryPath, JSON.stringify(procedure, null, 2));

      // Création d'une fiche sémantique simplifiée pour le fallback hors-ligne
      const projectionPath = `items/proc_${procedure.code.toLowerCase()}.json`;
      await postgresClient.saveFile(projectionPath, JSON.stringify({
        id: procedure.id,
        type: 'procedure',
        title: procedure.title,
        label: procedure.code,
        details: procedure.description,
        content: `Procédure technique pour ${procedure.title}. Inclut ${(procedure.steps as any[]).length} étapes opérationnelles.`,
        metadata: { origin: 'FORGE_SYSTEM', code: procedure.code }
      }, null, 2));
    } catch (fsErr: any) {
      console.warn(`⚠️ [REGISTRY_WRITE_WARN] ${fsErr.message}`);
    }

    // 4. Vectorisation RAG (Asynchrone)
    procedureRAG.indexProcedure(procedure as any).catch(ragErr => {
      console.error(`⚠️ [RAG_FAIL] Indexation vectorielle ignorée : ${ragErr.message}`);
    });

    return NextResponse.json({
      success: true,
      procedureId: procedure.id,
      message: `La procédure "${procedure.title}" a été forgée et indexée avec succès.`
    });

  } catch (error: any) {
    console.error('[API_FORGE_CRITICAL_FAIL] :', error.message);
    return NextResponse.json(
      { success: false, message: 'Échec de la forge industrielle.', error: error.message },
      { status: 500 }
    );
  }
}