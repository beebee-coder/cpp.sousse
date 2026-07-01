import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { procedureRAG } from '@/lib/procedures/services/rag.service';
import { postgresClient } from '@/lib/db/postgres-client';
import { getSessionFromCookie } from '@/lib/session';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * POST /api/procedures
 * Forge de procédure ultra-résiliente avec auto-réparation et gestion des collisions.
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const traceId = uuidv4().slice(0, 8);
  
  console.log(`🚀 [FORGE_API] [${traceId}] REQUÊTE_INITIÉE`);

  try {
    const session = await getSessionFromCookie();
    const body = await request.json().catch(() => null);
    
    if (!body || !body.title || !body.steps || !Array.isArray(body.steps)) {
      console.error(`❌ [FORGE_API] [${traceId}] PAYLOAD_INVALIDE`);
      return NextResponse.json({ 
        success: false, 
        message: 'Structure invalide : Titre et Séquences requis.',
        traceId 
      }, { status: 400 });
    }

    const { title, steps, metadata } = body;

    // 1. GESTION DE L'AUTEUR (Blindage et Fallback)
    let finalAuthorId: string | null = null;
    
    // Tenter de récupérer l'auteur depuis la session
    if (session?.user?.id) {
      const userExists = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (userExists) {
        finalAuthorId = session.user.id;
        console.log(`👤 [FORGE_API] [${traceId}] AUTEUR_SESSION : ${finalAuthorId}`);
      }
    }

    // Fallback automatique sur l'administrateur système si nécessaire
    if (!finalAuthorId) {
      console.log(`⚠️ [FORGE_API] [${traceId}] AUCUN_AUTEUR_SESSION. AUTO_RÉPARATION_ADMIN...`);
      const systemAdmin = await prisma.user.upsert({
        where: { email: 'admin@visionode.local' },
        update: { approved: true },
        create: {
          id: 'admin-root', // ID fixe pour la consistance système
          firstName: 'System',
          lastName: 'Administrator',
          email: 'admin@visionode.local',
          password: 'SYSTEM_PROTECTED_ACCOUNT',
          role: 'admin',
          approved: true
        }
      });
      finalAuthorId = systemAdmin.id;
      console.log(`✅ [FORGE_API] [${traceId}] AUTEUR_SYSTEME_VALIDÉ : ${finalAuthorId}`);
    }

    // 2. GESTION DU CODE (Collision-safe)
    let code = metadata?.code || `FORGE-${Date.now().toString().slice(-6)}`;
    const existingProc = await prisma.procedure.findUnique({ where: { code } });
    if (existingProc) {
      const originalCode = code;
      code = `${code}-${Math.floor(Math.random() * 1000)}`;
      console.log(`🔄 [FORGE_API] [${traceId}] COLLISION_CODE_DÉTECTÉE : ${originalCode} -> ${code}`);
    }

    // 3. TRANSACTION NEON SQL
    console.log(`💾 [FORGE_API] [${traceId}] ÉCRITURE_NEON_POSTGRESQL...`);
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
        authorId: finalAuthorId!,
        syncedLocal: false
      }
    });

    // 4. ARCHIVAGE PHYSIQUE DANS LE REGISTRE
    try {
      console.log(`📂 [FORGE_API] [${traceId}] ARCHIVAGE_PHYSIQUE_REGISTRE...`);
      const registryPath = `procedures/${procedure.code.toLowerCase()}/procedure.json`;
      await postgresClient.saveFile(registryPath, JSON.stringify(procedure, null, 2));

      // Projection sémantique pour recherche rapide hors-ligne
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
    } catch (fsErr: any) {
      console.warn(`⚠️ [FORGE_API] [${traceId}] ÉCHEC_ARCHIVAGE_FS (NON-BLOQUANT):`, fsErr.message);
    }

    // 5. VECTORISATION IA ASYNCHRONE
    console.log(`🧠 [FORGE_API] [${traceId}] INDEXATION_RAG_DÉTACHÉE...`);
    procedureRAG.indexProcedure(procedure as any).catch(err => {
       console.error(`⚠️ [FORGE_API] [${traceId}] ERREUR_RAG_IGNORÉE :`, err.message);
    });

    console.log(`✅ [FORGE_API] [${traceId}] FORGE_RÉUSSIE : "${procedure.title}"`);

    return NextResponse.json({
      success: true,
      procedureId: procedure.id,
      message: `Procédure "${procedure.title}" forgée avec succès.`,
      traceId
    });

  } catch (error: any) {
    console.error(`❌ [FORGE_API] [${traceId}] ERREUR_CRITIQUE :`, error.message, error.code);
    
    // Détection spécifique des erreurs Prisma
    let userMessage = 'Échec du service de forge industrielle.';
    if (error.code === 'P2002') userMessage = 'Collision critique : ce code de procédure est déjà réservé.';
    if (error.code === 'P2003') userMessage = 'Échec d\'accréditation : l\'auteur système est introuvable.';

    return NextResponse.json({ 
      success: false, 
      message: userMessage, 
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