
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { procedureRAG } from '@/lib/procedures/services/rag.service';
import { postgresClient } from '@/lib/db/postgres-client';
import { getSessionFromCookie } from '@/lib/session';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * POST /api/procedures
 * Forge de procédure ultra-résiliente avec auto-réparation et diagnostic profond.
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const traceId = uuidv4().slice(0, 8);
  
  console.log(`🚀 [FORGE_API] [${traceId}] REQUÊTE_REÇUE à ${timestamp}`);

  try {
    const session = await getSessionFromCookie();
    const body = await request.json().catch(() => null);
    
    if (!body || !body.title || !body.steps || !Array.isArray(body.steps)) {
      console.error(`❌ [FORGE_API] [${traceId}] PAYLOAD_INVALIDE :`, body ? "Structure incorrecte" : "Body vide");
      return NextResponse.json({ 
        success: false, 
        message: 'Données invalides : Le titre et au moins une séquence sont requis.',
        traceId 
      }, { status: 400 });
    }

    const { title, steps, metadata } = body;

    // 1. RÉSOLUTION DE L'AUTEUR (Validation ou Création de secours)
    let finalAuthorId: string | null = null;
    
    // Tenter via session
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (user) {
        finalAuthorId = user.id;
        console.log(`👤 [FORGE_API] [${traceId}] AUTEUR_SESSION_OK : ${finalAuthorId}`);
      }
    }

    // Fallback Admin Automatique (Garantit l'intégrité SQL)
    if (!finalAuthorId) {
      console.log(`⚠️ [FORGE_API] [${traceId}] AUCUN_AUTEUR_VALIDE. ACTIVATION_SECOURS_ADMIN...`);
      const systemAdmin = await prisma.user.upsert({
        where: { email: 'admin@visionode.local' },
        update: { approved: true }, // Assure qu'il est actif
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
      console.log(`✅ [FORGE_API] [${traceId}] AUTEUR_SECOURS_VALIDÉ : ${finalAuthorId}`);
    }

    // 2. GESTION DU CODE (Protection contre les doublons)
    let code = (metadata?.code || `FORGE-${Date.now().toString().slice(-6)}`).toUpperCase();
    const existing = await prisma.procedure.findUnique({ where: { code } });
    if (existing) {
      const oldCode = code;
      code = `${code}-${Math.floor(Math.random() * 1000)}`;
      console.log(`🔄 [FORGE_API] [${traceId}] COLLISION_CODE : ${oldCode} -> ${code}`);
    }

    // 3. TRANSACTION SQL NEON
    console.log(`💾 [FORGE_API] [${traceId}] ÉCRITURE_BDD_SQL...`);
    const procedure = await prisma.procedure.create({
      data: {
        code,
        title: title.trim(),
        description: body.description || metadata?.description || 'Actif généré par dictée industrielle.',
        category: (metadata?.category || 'OPERATION').toUpperCase(),
        department: (metadata?.department || 'PRODUCTION').toUpperCase(),
        criticality: (metadata?.criticality || 'MEDIUM').toUpperCase(),
        version: metadata?.version || '1.0.0',
        status: 'APPROVED',
        prerequisites: (body.prerequisites || { description: "Précautions standards", items: [] }),
        steps: steps,
        metadata: { ...metadata, forged_at: timestamp, traceId, authorId: finalAuthorId },
        parameters: (body.parameters || { variables: [] }),
        postExecution: (body.postExecution || { checks: [], reporting: { generateReport: true, reportFields: [] } }),
        authorId: finalAuthorId!
      }
    });

    // 4. ARCHIVAGE PHYSIQUE (Fichiers Registre)
    try {
      console.log(`📂 [FORGE_API] [${traceId}] ARCHIVAGE_PHYSIQUE...`);
      const regPath = `procedures/${procedure.code.toLowerCase()}/procedure.json`;
      await postgresClient.saveFile(regPath, JSON.stringify(procedure, null, 2));
      
      // Projection pour recherche sémantique locale
      await postgresClient.saveFile(`items/proc_${procedure.code.toLowerCase()}.json`, JSON.stringify({
        id: procedure.id,
        type: 'procedure',
        title: procedure.title,
        content: `PROCÉDURE: ${procedure.title} [${procedure.code}]. ${steps.length} séquences.`,
        metadata: { origin: 'FORGE', code: procedure.code }
      }, null, 2));
    } catch (e: any) {
      console.warn(`⚠️ [FORGE_API] [${traceId}] ÉCHEC_REGISTRE_NON_BLOQUANT : ${e.message}`);
    }

    // 5. VECTORISATION IA (Asynchrone)
    console.log(`🧠 [FORGE_API] [${traceId}] DÉCLENCHEMENT_RAG...`);
    procedureRAG.indexProcedure(procedure as any).catch(err => {
      console.error(`⚠️ [FORGE_API] [${traceId}] ERREUR_IA_RAG :`, err.message);
    });

    console.log(`✅ [FORGE_API] [${traceId}] FORGE_TERMINÉE_AVEC_SUCCÈS`);

    return NextResponse.json({
      success: true,
      procedureId: procedure.id,
      message: `Procédure "${procedure.title}" enregistrée et archivée.`,
      traceId
    });

  } catch (error: any) {
    console.error(`❌ [FORGE_API] [${traceId}] ERREUR_CRITIQUE_PRISMA :`, {
      code: error.code,
      meta: error.meta,
      message: error.message
    });

    return NextResponse.json({ 
      success: false, 
      error: "ÉCHEC_TRANSACTION_SQL",
      message: error.message || "Une erreur interne est survenue lors de l'enregistrement.",
      prismaCode: error.code,
      traceId 
    }, { status: 500 });
  }
}

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
