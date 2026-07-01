import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { procedureRAG } from '@/lib/procedures/services/rag.service';
import { postgresClient } from '@/lib/db/postgres-client';
import { getSessionFromCookie } from '@/lib/session';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * POST /api/procedures
 * Forge de procédure ultra-résiliente avec audit détaillé.
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const traceId = uuidv4().slice(0, 8);
  console.log(`🚀 [${traceId}] [API_PROC_POST] Initiation de la forge...`);

  try {
    const session = await getSessionFromCookie();
    const body = await request.json();
    const { title, steps, metadata } = body;

    if (!title || !steps || !Array.isArray(steps)) {
      console.error(`❌ [${traceId}] [API_PROC_POST] Structure invalide reçue.`);
      return NextResponse.json({ success: false, message: 'Structure invalide : Titre et Étapes requis.' }, { status: 400 });
    }

    // 1. Identification ou Création de l'auteur (Crucial)
    let authorId = session?.user?.id;
    if (!authorId) {
      console.log(`🕵️ [${traceId}] [API_PROC_POST] Session absente, identification admin-root...`);
      const rootAdmin = await prisma.user.upsert({
        where: { email: 'admin@visionode.local' },
        update: { approved: true },
        create: {
          id: 'admin-root',
          firstName: 'System',
          lastName: 'Administrator',
          email: 'admin@visionode.local',
          password: 'System@NoPassword@2024',
          role: 'admin',
          approved: true
        }
      });
      authorId = rootAdmin.id;
    }

    const code = metadata?.code || `FORGE-${Date.now().toString().slice(-6)}`;
    const procId = uuidv4();

    // 2. Enregistrement Neon SQL
    console.log(`💾 [${traceId}] [API_PROC_POST] Insertion Neon SQL pour ${code}...`);
    const procedure = await prisma.procedure.create({
      data: {
        id: procId,
        code,
        title: title.trim(),
        description: body.description || metadata?.description || 'Procédure générée via Station de Dictée.',
        category: String(metadata?.category || 'OPERATION').toUpperCase(),
        department: String(metadata?.department || 'PRODUCTION').toUpperCase(),
        criticality: String(metadata?.criticality || 'MEDIUM').toUpperCase(),
        version: metadata?.version || '1.0.0',
        status: 'APPROVED',
        prerequisites: body.prerequisites || { description: "Sécurité standard", items: [] },
        steps: steps,
        metadata: { ...metadata, authorId, traceId, forged_at: timestamp },
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

      // Projection sémantique pour recherche offline
      const projectionPath = `items/proc_${procedure.code.toLowerCase()}.json`;
      await postgresClient.saveFile(projectionPath, JSON.stringify({
        id: procedure.id,
        procedureId: procedure.id,
        type: 'procedure',
        title: procedure.title,
        label: procedure.code,
        content: `PROCÉDURE: ${procedure.title}. ${steps.length} étapes.`,
        metadata: { origin: 'FORGE_SYSTEM', code: procedure.code }
      }, null, 2));
      
      console.log(`✅ [${traceId}] [API_PROC_POST] Archivage physique réussi.`);
    } catch (fsErr: any) {
      console.error(`⚠️ [${traceId}] [API_PROC_POST] Échec archivage physique : ${fsErr.message}`);
    }

    // 4. Vectorisation RAG (Background)
    procedureRAG.indexProcedure(procedure as any).catch(e => console.error("RAG_FAIL:", e.message));

    console.log(`🏁 [${traceId}] [API_PROC_POST] Forge terminée avec succès.`);
    return NextResponse.json({
      success: true,
      procedureId: procedure.id,
      message: `La procédure "${procedure.title}" est forgée.`
    });

  } catch (error: any) {
    console.error(`❌ [${traceId}] [API_PROC_POST] ÉCHEC :`, error.message);
    return NextResponse.json(
      { success: false, message: 'Échec de la forge industrielle.', error: error.message },
      { status: 500 }
    );
  }
}

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
    return NextResponse.json({ success: false, message: 'Erreur lecture.', error: error.message }, { status: 500 });
  }
}
