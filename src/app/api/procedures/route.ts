import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { procedureRAG } from '@/lib/procedures/services/rag.service';
import { postgresClient } from '@/lib/db/postgres-client';
import { getSessionFromCookie } from '@/lib/session';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * POST /api/procedures
 * Forge de procédure ultra-résiliente avec audit détaillé et auto-réparation d'auteur.
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const traceId = uuidv4().slice(0, 8);
  console.log(`\n🚀 [${traceId}] [FORGE_START] Initiation de la forge industrielle...`);

  try {
    const session = await getSessionFromCookie();
    console.log(`🕵️ [${traceId}] [FORGE_AUTH] État session:`, session ? `Connecté (${session.user.id})` : 'Hors-session');

    const body = await request.json().catch(() => null);
    if (!body || !body.title || !body.steps || !Array.isArray(body.steps)) {
      console.error(`❌ [${traceId}] [FORGE_ERROR] Corps de requête invalide ou incomplet.`);
      return NextResponse.json({ 
        success: false, 
        message: 'Structure invalide : Titre et Étapes requis.',
        traceId 
      }, { status: 400 });
    }

    const { title, steps, metadata } = body;
    console.log(`📝 [${traceId}] [FORGE_DATA] Titre: "${title}", Étapes: ${steps.length}`);

    // 1. Validation de l'Auteur en Base (Crucial pour éviter P2003)
    let finalAuthorId: string | null = null;

    if (session?.user?.id) {
      const userExists = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (userExists) {
        finalAuthorId = session.user.id;
        console.log(`✅ [${traceId}] [FORGE_AUTH] Auteur session validé: ${finalAuthorId}`);
      } else {
        console.warn(`⚠️ [${traceId}] [FORGE_AUTH] L'utilisateur en session n'existe plus en base.`);
      }
    }

    if (!finalAuthorId) {
      console.log(`🔧 [${traceId}] [FORGE_AUTH] Recherche ou création de l'auteur système (admin-root)...`);
      const systemAdmin = await prisma.user.upsert({
        where: { email: 'admin@visionode.local' },
        update: { approved: true },
        create: {
          id: 'admin-root',
          firstName: 'System',
          lastName: 'Administrator',
          email: 'admin@visionode.local',
          password: 'SYSTEM_PROTECTED_ACCOUNT',
          role: 'admin',
          approved: true
        }
      });
      finalAuthorId = systemAdmin.id;
      console.log(`✅ [${traceId}] [FORGE_AUTH] Auteur système utilisé: ${finalAuthorId}`);
    }

    // 2. Gestion de l'unicité du Code
    let code = metadata?.code || `FORGE-${Date.now().toString().slice(-6)}`;
    const existingProc = await prisma.procedure.findUnique({ where: { code } });
    if (existingProc) {
      const newCode = `${code}-${Math.floor(Math.random() * 1000)}`;
      console.warn(`⚠️ [${traceId}] [FORGE_COLLISION] Code "${code}" déjà utilisé. Mutation vers "${newCode}"`);
      code = newCode;
    }

    const procId = uuidv4();

    // 3. Enregistrement Neon SQL
    console.log(`💾 [${traceId}] [FORGE_SQL] Tentative d'insertion Prisma...`);
    try {
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
          metadata: { ...metadata, authorId: finalAuthorId, traceId, forged_at: timestamp },
          parameters: body.parameters || { variables: [] },
          postExecution: body.postExecution || { checks: [], reporting: { generateReport: true, reportFields: [] } },
          authorId: finalAuthorId,
          syncedLocal: false
        }
      });
      console.log(`✅ [${traceId}] [FORGE_SQL_SUCCESS] Procédure enregistrée ID: ${procedure.id}`);

      // 4. Archivage Physique (Registre .registry/)
      console.log(`📂 [${traceId}] [FORGE_FS] Écriture disque...`);
      try {
        const registryPath = `procedures/${procedure.code.toLowerCase()}/procedure.json`;
        await postgresClient.saveFile(registryPath, JSON.stringify(procedure, null, 2));

        const projectionPath = `items/proc_${procedure.code.toLowerCase()}.json`;
        await postgresClient.saveFile(projectionPath, JSON.stringify({
          id: procedure.id,
          procedureId: procedure.id,
          type: 'procedure',
          title: procedure.title,
          label: procedure.code,
          content: `PROCÉDURE INDUSTRIELLE: ${procedure.title}. ${steps.length} séquences opérationnelles.`,
          metadata: { origin: 'FORGE_SYSTEM', code: procedure.code, traceId }
        }, null, 2));
        
        console.log(`✅ [${traceId}] [FORGE_FS_SUCCESS] Fichiers écrits.`);
      } catch (fsErr: any) {
        console.error(`⚠️ [${traceId}] [FORGE_FS_FAIL] Erreur disque:`, fsErr.message);
      }

      // 5. Vectorisation (Background)
      procedureRAG.indexProcedure(procedure as any).catch(e => console.error(`⚠️ [${traceId}] [FORGE_RAG_FAIL]`, e.message));

      return NextResponse.json({
        success: true,
        procedureId: procedure.id,
        message: `Procédure "${procedure.title}" forgée avec succès.`,
        traceId
      });

    } catch (prismaErr: any) {
      console.error(`❌ [${traceId}] [FORGE_SQL_FAIL] Erreur Prisma:`, prismaErr.code, prismaErr.message);
      return NextResponse.json({ 
        success: false, 
        message: 'Erreur SQL critique lors de l\'enregistrement.', 
        error: prismaErr.message,
        code: prismaErr.code,
        traceId 
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error(`❌ [${traceId}] [FORGE_FATAL]`, error.message);
    return NextResponse.json(
      { success: false, message: 'Échec critique du service de forge.', error: error.message, traceId },
      { status: 500 }
    );
  }
}

/**
 * GET /api/procedures
 */
export async function GET() {
  try {
    const procedures = await prisma.procedure.findMany({
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { firstName: true, lastName: true } } }
    });
    return NextResponse.json({ success: true, procedures });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
