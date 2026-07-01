import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { procedureRAG } from '@/lib/procedures/services/rag.service';
import { postgresClient } from '@/lib/db/postgres-client';
import { getSessionFromCookie } from '@/lib/session';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * POST /api/procedures
 * Forge de procédure industrielle avec logs structurés [FORGE_API].
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const traceId = uuidv4().slice(0, 8);
  
  console.log(`🚀 [FORGE_API] [INIT] [${traceId}] Réception d'une demande de forge.`);

  try {
    const session = await getSessionFromCookie();
    const body = await request.json().catch(() => null);
    
    if (!body || !body.title || !body.steps || !Array.isArray(body.steps)) {
      console.error(`❌ [FORGE_API] [ERROR] [${traceId}] Payload invalide.`);
      return NextResponse.json({ 
        success: false, 
        message: 'Données invalides : Le titre et les séquences sont requis.',
        traceId 
      }, { status: 400 });
    }

    const { title, steps, metadata } = body;
    let code = (metadata?.code || `FORGE-${Date.now().toString().slice(-6)}`).toUpperCase();

    // -------------------------------------------------------------------------
    // ÉTAPE 1 : ARCHIVAGE PHYSIQUE [FORGE_FS]
    // -------------------------------------------------------------------------
    console.log(`📂 [FORGE_FS] [STEP] [${traceId}] Tentative d'écriture dans le Registre Physique...`);
    let fsPath = '';
    try {
      const regPath = `procedures/${code.toLowerCase()}/procedure.json`;
      const fileData = {
        id: uuidv4(),
        code,
        title: title.trim(),
        steps,
        metadata: { ...metadata, forged_at: timestamp, traceId, storage: 'PHYSICAL_REGISTRY' },
        createdAt: timestamp
      };
      await postgresClient.saveFile(regPath, JSON.stringify(fileData, null, 2));
      fsPath = regPath;
      console.log(`✅ [FORGE_FS] [SUCCESS] [${traceId}] Archive physique créée : ${regPath}`);
    } catch (fsError: any) {
      console.error(`❌ [FORGE_FS] [ERROR] [${traceId}] Échec critique écriture disque:`, fsError.message);
      return NextResponse.json({ success: false, message: 'Échec de l\'écriture disque.', traceId }, { status: 500 });
    }

    // -------------------------------------------------------------------------
    // ÉTAPE 2 : SYNCHRO SQL [FORGE_SQL]
    // -------------------------------------------------------------------------
    let sqlStatus = 'BYPASSED';
    let dbDiagnostic = 'NONE';

    try {
      console.log(`💾 [FORGE_SQL] [STEP] [${traceId}] Tentative de synchronisation Neon...`);
      const p = prisma as any;
      
      if (p && p.user && p.procedure) {
        let authorId = session?.user?.id;
        
        // Garantir un auteur système
        console.log(`👤 [FORGE_SQL] [STEP] [${traceId}] Vérification de l'auteur...`);
        const systemAdmin = await p.user.upsert({
          where: { email: 'admin@visionode.local' },
          update: { approved: true },
          create: {
            id: 'admin-root',
            firstName: 'System',
            lastName: 'Administrator',
            email: 'admin@visionode.local',
            password: 'SYSTEM_PROTECTED',
            role: 'admin',
            approved: true
          }
        });

        if (!authorId) {
          console.log(`ℹ️ [FORGE_SQL] [INFO] [${traceId}] Session absente, utilisation de l'auteur système.`);
          authorId = systemAdmin.id;
        }

        await p.procedure.create({
          data: {
            code,
            title: title.trim(),
            description: body.description || metadata?.description || 'Généré par forge industrielle.',
            category: (metadata?.category || 'OPERATION').toUpperCase(),
            department: (metadata?.department || 'PRODUCTION').toUpperCase(),
            criticality: (metadata?.criticality || 'MEDIUM').toUpperCase(),
            version: metadata?.version || '1.0.0',
            status: 'APPROVED',
            prerequisites: (body.prerequisites || { description: "Standard", items: [] }),
            steps: steps as any,
            metadata: { ...metadata, forged_at: timestamp, traceId, storage: 'HYBRID' },
            authorId: authorId
          }
        });
        
        sqlStatus = 'OK';
        console.log(`✅ [FORGE_SQL] [SUCCESS] [${traceId}] Synchronisation SQL Neon réussie.`);
      } else {
        dbDiagnostic = 'PRISMA_CLIENT_INCOMPLETE';
        console.warn(`⚠️ [FORGE_SQL] [BYPASS] [${traceId}] Bypass SQL: Modèles non trouvés dans le client.`);
      }
    } catch (e: any) {
      sqlStatus = 'FAILED_SILENT';
      dbDiagnostic = e.message;
      console.warn(`⚠️ [FORGE_SQL] [FAIL_BYPASS] [${traceId}] Échec Neon, mais continuation via Registre:`, dbDiagnostic);
    }

    // -------------------------------------------------------------------------
    // ÉTAPE 3 : VECTORISATION [FORGE_RAG]
    // -------------------------------------------------------------------------
    console.log(`🧠 [FORGE_RAG] [STEP] [${traceId}] Déclenchement de la vectorisation IA...`);
    procedureRAG.indexProcedure({ code, title, steps, metadata } as any).catch((err) => {
      console.warn(`⚠️ [FORGE_RAG] [ERROR] [${traceId}] Vectorisation échouée :`, err.message);
    });

    return NextResponse.json({
      success: true,
      message: sqlStatus === 'OK' 
        ? `Procédure "${title}" forgée et synchronisée.` 
        : `Procédure "${title}" archivée physiquement (Mode SQL Bypass).`,
      traceId,
      fsPath,
      sqlStatus,
      diagnostic: dbDiagnostic
    });

  } catch (error: any) {
    console.error(`❌ [FORGE_API] [FATAL] [${traceId}] Erreur imprévue:`, error.message);
    return NextResponse.json({ 
      success: false, 
      message: `Erreur fatale : ${error.message}`,
      traceId 
    }, { status: 500 });
  }
}

export async function GET() {
  console.log(`🔍 [FORGE_API] [LIST] Lecture du registre complet.`);
  try {
    const procedures = await prisma.procedure.findMany({
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { firstName: true, lastName: true } } }
    }).catch(() => []);
    
    return NextResponse.json({ success: true, procedures });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
