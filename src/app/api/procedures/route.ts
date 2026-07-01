import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { procedureRAG } from '@/lib/procedures/services/rag.service';
import { postgresClient } from '@/lib/db/postgres-client';
import { getSessionFromCookie } from '@/lib/session';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * POST /api/procedures
 * Forge de procédure avec auto-réparation et gestion des collisions.
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const traceId = uuidv4().slice(0, 8);
  
  console.log(`🚀 [FORGE_API] [${traceId}] Initiation de la requête...`);

  try {
    const session = await getSessionFromCookie();
    const body = await request.json().catch(() => null);
    
    if (!body || !body.title || !body.steps || !Array.isArray(body.steps)) {
      console.error(`❌ [FORGE_API] [${traceId}] Payload invalide.`);
      return NextResponse.json({ 
        success: false, 
        message: 'Structure invalide : Titre et Étapes requis.',
        traceId 
      }, { status: 400 });
    }

    const { title, steps, metadata } = body;

    // 1. GESTION DE L'AUTEUR (Résiliente)
    let finalAuthorId: string | null = null;
    
    if (session?.user?.id) {
      const userExists = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (userExists) {
        finalAuthorId = session.user.id;
        console.log(`👤 [FORGE_API] [${traceId}] Auteur session : ${finalAuthorId}`);
      }
    }

    if (!finalAuthorId) {
      console.log(`⚠️ [FORGE_API] [${traceId}] Aucun auteur session. Fallback admin-root...`);
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
    }

    // 2. GESTION DU CODE (Collision-safe)
    let code = metadata?.code || `FORGE-${Date.now().toString().slice(-6)}`;
    const existingProc = await prisma.procedure.findUnique({ where: { code } });
    if (existingProc) {
      const originalCode = code;
      code = `${code}-${Math.floor(Math.random() * 1000)}`;
      console.log(`🔄 [FORGE_API] [${traceId}] Collision code : ${originalCode} -> ${code}`);
    }

    // 3. ENREGISTREMENT NEON SQL
    console.log(`💾 [FORGE_API] [${traceId}] Écriture Neon PostgreSQL...`);
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
        prerequisites: (body.prerequisites || { description: "Sécurité standard", items: [] }),
        steps: steps,
        metadata: { ...metadata, authorId: finalAuthorId, traceId, forged_at: timestamp },
        parameters: (body.parameters || { variables: [] }),
        postExecution: (body.postExecution || { checks: [], reporting: { generateReport: true, reportFields: [] } }),
        authorId: finalAuthorId,
        syncedLocal: false
      }
    });

    // 4. ARCHIVAGE PHYSIQUE
    try {
      console.log(`📂 [FORGE_API] [${traceId}] Archivage dans le Registre Physique...`);
      const registryPath = `procedures/${procedure.code.toLowerCase()}/procedure.json`;
      await postgresClient.saveFile(registryPath, JSON.stringify(procedure, null, 2));

      // Projection sémantique pour la recherche rapide
      const projectionPath = `items/proc_${procedure.code.toLowerCase()}.json`;
      await postgresClient.saveFile(projectionPath, JSON.stringify({
        id: procedure.id,
        procedureId: procedure.id,
        type: 'procedure',
        title: procedure.title,
        label: procedure.code,
        content: `PROCÉDURE INDUSTRIELLE: ${procedure.title}. ${steps.length} séquences.`,
        metadata: { origin: 'FORGE_SYSTEM', code: procedure.code, traceId }
      }, null, 2));
    } catch (fsErr: any) {
      console.warn(`⚠️ [FORGE_API] [${traceId}] Échec archivage FS (non-bloquant):`, fsErr.message);
    }

    // 5. VECTORISATION ASYNCHRONE
    console.log(`🧠 [FORGE_API] [${traceId}] Déclenchement vectorisation RAG...`);
    procedureRAG.indexProcedure(procedure as any).catch(err => {
       console.error(`⚠️ [FORGE_API] [${traceId}] Erreur RAG ignorée :`, err.message);
    });

    console.log(`✅ [FORGE_API] [${traceId}] Forge réussie pour "${procedure.title}"`);

    return NextResponse.json({
      success: true,
      procedureId: procedure.id,
      message: `Procédure "${procedure.title}" forgée avec succès.`,
      traceId
    });

  } catch (error: any) {
    console.error(`❌ [FORGE_API] [${traceId}] Erreur fatale :`, error.message, error.code);
    return NextResponse.json({ 
      success: false, 
      message: 'Échec du service de forge.', 
      error: error.message,
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