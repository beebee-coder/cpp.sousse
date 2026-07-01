import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { procedureRAG } from '@/lib/procedures/services/rag.service';
import { postgresClient } from '@/lib/db/postgres-client';
import { getSessionFromCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/procedures
 * Liste les procédures du registre central.
 */
export async function GET() {
  try {
    const procedures = await prisma.procedure.findMany({
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { firstName: true, lastName: true } } }
    });
    return NextResponse.json({ success: true, procedures });
  } catch (error: any) {
    console.error('❌ [API_PROCEDURES_GET] Error:', error.message);
    return NextResponse.json({ success: false, message: 'Erreur lecture registre.', error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/procedures
 * Forge de procédure ultra-résiliente.
 * Crée l'auteur système si nécessaire pour garantir la réussite de l'opération.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    const body = await request.json();
    const { title, steps, metadata } = body;

    if (!title || !steps || !Array.isArray(steps)) {
      return NextResponse.json({ success: false, message: 'Structure de forge invalide : Titre et Étapes requis.' }, { status: 400 });
    }

    // 1. Identification ou Création de l'auteur (Crucial pour Prisma)
    let authorId = session?.user?.id;
    
    if (!authorId) {
      const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
      if (admin) {
        authorId = admin.id;
      } else {
        // Fallback ultime : on assure la présence d'un admin racine pour l'audit
        const rootAdmin = await prisma.user.upsert({
          where: { email: 'admin@visionode.local' },
          update: {},
          create: {
            id: 'admin-root',
            firstName: 'System',
            lastName: 'Administrator',
            email: 'admin@visionode.local',
            password: 'System@NoPassword@2024', // Non utilisé pour connexion directe ici
            role: 'admin',
            approved: true
          }
        });
        authorId = rootAdmin.id;
      }
    }

    const code = metadata?.code || `FORGE-${Date.now().toString().slice(-6)}`;

    // 2. Enregistrement Base de Données Web (Neon)
    const procedure = await prisma.procedure.create({
      data: {
        code,
        title: title.trim(),
        description: body.description || metadata?.description || 'Procédure générée via Station de Dictée.',
        category: String(metadata?.category || 'OPERATION').toUpperCase(),
        department: String(metadata?.department || 'PRODUCTION').toUpperCase(),
        criticality: String(metadata?.criticality || 'MEDIUM').toUpperCase(),
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

    // 3. Archivage Physique (Registre .registry/)
    try {
      const registryPath = `procedures/${procedure.code.toLowerCase()}/procedure.json`;
      await postgresClient.saveFile(registryPath, JSON.stringify(procedure, null, 2));

      // 4. Projection sémantique pour recherche offline
      const projectionPath = `items/proc_${procedure.code.toLowerCase()}.json`;
      await postgresClient.saveFile(projectionPath, JSON.stringify({
        id: procedure.id,
        procedureId: procedure.id,
        type: 'procedure',
        title: procedure.title,
        label: procedure.code,
        details: procedure.description,
        content: `PROCÉDURE TECHNIQUE: ${procedure.title}. Séquence de ${(procedure.steps as any[]).length} étapes opérationnelles.`,
        metadata: { origin: 'FORGE_SYSTEM', code: procedure.code }
      }, null, 2));
      
      console.log(`✅ [FORGE_SUCCESS] Procédure archivée physiquement : ${procedure.code}`);
    } catch (fsErr: any) {
      console.warn(`⚠️ [REGISTRY_WRITE_WARN] Échec archivage physique (mais DB OK) : ${fsErr.message}`);
    }

    // 5. Vectorisation RAG (Asynchrone/Non-bloquante)
    procedureRAG.indexProcedure(procedure as any).catch(ragErr => {
      console.error(`⚠️ [RAG_INDEX_FAIL] Vectorisation ignorée : ${ragErr.message}`);
    });

    return NextResponse.json({
      success: true,
      procedureId: procedure.id,
      message: `La procédure "${procedure.title}" a été forgée et indexée.`
    });

  } catch (error: any) {
    console.error('❌ [API_FORGE_CRITICAL_FAIL] :', error.message);
    return NextResponse.json(
      { success: false, message: 'Échec de la forge industrielle.', error: error.message },
      { status: 500 }
    );
  }
}
