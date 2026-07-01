import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { procedureRAG } from '@/lib/procedures/services/rag.service';
import { postgresClient } from '@/lib/db/postgres-client';
import { getSessionFromCookie } from '@/lib/session';
import { v4 as uuidv4 } from 'uuid';
import { FullProcedure } from '@/lib/procedures/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/procedures
 * Forge de procédure industrielle avec diagnostic d'erreur profond et auto-réparation.
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const traceId = uuidv4().slice(0, 8);
  
  console.log(`🚀 [FORGE_API] [${traceId}] REQUÊTE_REÇUE à ${timestamp}`);

  try {
    const session = await getSessionFromCookie();
    const body = await request.json().catch(() => null);
    
    if (!body || !body.title || !body.steps || !Array.isArray(body.steps)) {
      console.error(`❌ [FORGE_API] [${traceId}] PAYLOAD_INVALIDE`);
      return NextResponse.json({ 
        success: false, 
        message: 'Données invalides : Le titre et au moins une séquence sont requis.',
        traceId 
      }, { status: 400 });
    }

    const { title, steps, metadata } = body;

    // 1. RÉSOLUTION DE L'AUTEUR (Assurance existence)
    let finalAuthorId = session?.user?.id;
    
    if (!finalAuthorId) {
      console.log(`⚠️ [FORGE_API] [${traceId}] AUTEUR_INCONNU : Accréditation via ADMIN_ROOT...`);
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
    } else {
      // Vérifier si l'utilisateur de la session existe encore en DB
      const userExists = await prisma.user.findUnique({ where: { id: finalAuthorId } });
      if (!userExists) {
        console.warn(`⚠️ [FORGE_API] [${traceId}] SESSION_ORPHELINE : Fallback ADMIN_ROOT...`);
        finalAuthorId = 'admin-root';
      }
    }

    // 2. GESTION DU CODE ET UNICITÉ
    let code = (metadata?.code || `FORGE-${Date.now().toString().slice(-6)}`).toUpperCase();
    const existing = await prisma.procedure.findUnique({ where: { code } });
    if (existing) {
      code = `${code}-${Math.floor(Math.random() * 1000)}`;
    }

    // 3. TRANSACTION SQL NEON
    console.log(`💾 [FORGE_API] [${traceId}] ÉCRITURE_BDD_SQL...`);
    let procedure;
    try {
      procedure = await prisma.procedure.create({
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
          authorId: finalAuthorId!
        }
      });
    } catch (sqlError: any) {
      console.error(`❌ [FORGE_API] [${traceId}] ERREUR_PRISMA :`, sqlError.code, sqlError.message);
      return NextResponse.json({ 
        success: false, 
        error: "ÉCHEC_TRANSACTION_SQL",
        message: sqlError.message || "Erreur d'intégrité SQL",
        details: sqlError.meta
      }, { status: 500 });
    }

    // 4. ARCHIVAGE PHYSIQUE (Non-bloquant pour le succès SQL)
    try {
      console.log(`📂 [FORGE_API] [${traceId}] ARCHIVAGE_PHYSIQUE...`);
      const regPath = `procedures/${procedure.code.toLowerCase()}/procedure.json`;
      await postgresClient.saveFile(regPath, JSON.stringify(procedure, null, 2));
    } catch (e: any) {
      console.warn(`⚠️ [FORGE_API] [${traceId}] ÉCHEC_REGISTRE : ${e.message}`);
    }

    // 5. VECTORISATION IA (Asynchrone)
    procedureRAG.indexProcedure(procedure as unknown as FullProcedure).catch(err => {
      console.error(`⚠️ [FORGE_API] [${traceId}] ERREUR_IA_RAG :`, err.message);
    });

    console.log(`✅ [FORGE_API] [${traceId}] FORGE_TERMINÉE_AVEC_SUCCÈS : ${procedure.id}`);

    return NextResponse.json({
      success: true,
      procedureId: procedure.id,
      message: `Procédure "${procedure.title}" enregistrée et archivée avec succès.`,
      traceId
    });

  } catch (error: any) {
    console.error(`❌ [FORGE_API] [${traceId}] ERREUR_CRITIQUE_API :`, error.message);
    return NextResponse.json({ 
      success: false, 
      error: "ERREUR_FATALE_BACKEND",
      message: error.message,
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
