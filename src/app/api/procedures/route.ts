import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { procedureRAG } from '@/lib/procedures/services/rag.service';
import { postgresClient } from '@/lib/db/postgres-client';
import { getSessionFromCookie } from '@/lib/session';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * POST /api/procedures
 * Forge de procédure ultra-résiliente avec audit détaillé et logs intensifs.
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const traceId = uuidv4().slice(0, 8);
  console.log(`\n🚀 [${traceId}] [FORGE_START] Initiation de la forge industrielle...`);

  try {
    const session = await getSessionFromCookie();
    console.log(`🕵️ [${traceId}] [FORGE_AUTH] État session:`, session ? `Connecté (${session.user.role})` : 'Hors-session');

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

    // 1. Identification de l'auteur (Crucial pour la contrainte SQL)
    let authorId = session?.user?.id;
    if (!authorId) {
      console.log(`⚠️ [${traceId}] [FORGE_AUTH] Aucun auteur en session. Tentative identification admin-root...`);
      try {
        const rootAdmin = await prisma.user.upsert({
          where: { email: 'admin@visionode.local' },
          update: { approved: true },
          create: {
            id: 'admin-root',
            firstName: 'System',
            lastName: 'Administrator',
            email: 'admin@visionode.local',
            password: 'System@NoPassword@2024', // Ne sera pas utilisé car bypassé par le mécanisme de session
            role: 'admin',
            approved: true
          }
        });
        authorId = rootAdmin.id;
        console.log(`✅ [${traceId}] [FORGE_AUTH] Auteur substitué: ${authorId}`);
      } catch (authErr: any) {
        console.error(`❌ [${traceId}] [FORGE_AUTH_CRASH] Échec création auteur système:`, authErr.message);
        throw new Error(`Erreur d'accréditation système: ${authErr.message}`);
      }
    }

    const code = metadata?.code || `FORGE-${Date.now().toString().slice(-6)}`;
    const procId = uuidv4();

    // 2. Enregistrement Neon SQL
    console.log(`💾 [${traceId}] [FORGE_SQL] Tentative d'insertion Prisma pour le code: ${code}...`);
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
          metadata: { ...metadata, authorId, traceId, forged_at: timestamp },
          parameters: body.parameters || { variables: [] },
          postExecution: body.postExecution || { checks: [], reporting: { generateReport: true, reportFields: [] } },
          authorId: authorId,
          syncedLocal: false
        }
      });
      console.log(`✅ [${traceId}] [FORGE_SQL_SUCCESS] Procédure enregistrée en DB avec ID: ${procedure.id}`);

      // 3. Archivage Physique (Registre .registry/)
      console.log(`📂 [${traceId}] [FORGE_FS] Archivage physique dans le registre...`);
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
          metadata: { origin: 'FORGE_SYSTEM', code: procedure.code, traceId }
        }, null, 2));
        
        console.log(`✅ [${traceId}] [FORGE_FS_SUCCESS] Archivage physique terminé.`);
      } catch (fsErr: any) {
        console.error(`⚠️ [${traceId}] [FORGE_FS_FAIL] Échec archivage physique:`, fsErr.message);
      }

      // 4. Vectorisation RAG (Background)
      console.log(`🧠 [${traceId}] [FORGE_RAG] Déclenchement de la vectorisation...`);
      procedureRAG.indexProcedure(procedure as any)
        .then(() => console.log(`✅ [${traceId}] [FORGE_RAG_SUCCESS] Vectorisation terminée.`))
        .catch(e => console.error(`⚠️ [${traceId}] [FORGE_RAG_FAIL] Échec vectorisation:`, e.message));

      console.log(`🏁 [${traceId}] [FORGE_COMPLETE] Succès total de l'opération.`);
      return NextResponse.json({
        success: true,
        procedureId: procedure.id,
        message: `La procédure "${procedure.title}" est forgée et archivée.`,
        traceId
      });

    } catch (prismaErr: any) {
      console.error(`❌ [${traceId}] [FORGE_SQL_FAIL] Erreur Prisma critique:`);
      console.error(`   Code: ${prismaErr.code}`);
      console.error(`   Message: ${prismaErr.message}`);
      if (prismaErr.meta) console.error(`   Meta:`, prismaErr.meta);
      
      return NextResponse.json({ 
        success: false, 
        message: 'Échec de l\'enregistrement en base de données.', 
        error: prismaErr.message,
        code: prismaErr.code,
        traceId 
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error(`❌ [${traceId}] [FORGE_FATAL] Erreur globale non gérée:`, error.message);
    return NextResponse.json(
      { success: false, message: 'Échec critique de la forge industrielle.', error: error.message, traceId },
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
    return NextResponse.json({ success: false, message: 'Erreur lecture registre.', error: error.message }, { status: 500 });
  }
}
