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
 * Forge de procédure industrielle.
 * Gère l'auto-réparation de l'auteur système et les collisions de codes.
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const traceId = uuidv4().slice(0, 8);
  
  console.log(`🚀 [FORGE_API] [${traceId}] REQUÊTE_REÇUE à ${timestamp}`);

  try {
    // Vérification de l'existence du client Prisma
    if (!prisma || !prisma.user) {
      console.error(`❌ [FORGE_API] [${traceId}] CLIENT_PRISMA_NON_INITIALISE`);
      return NextResponse.json({ 
        success: false, 
        message: 'Erreur système : Le moteur de données Prisma est mal configuré.',
        traceId 
      }, { status: 500 });
    }

    const session = await getSessionFromCookie();
    const body = await request.json().catch(() => null);
    
    if (!body || !body.title || !body.steps || !Array.isArray(body.steps)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Données invalides : Le titre et les séquences sont requis.',
        traceId 
      }, { status: 400 });
    }

    const { title, steps, metadata } = body;

    // 1. RÉSOLUTION DE L'AUTEUR (Garantie d'existence)
    let finalAuthorId = session?.user?.id;
    
    // Vérifier si l'utilisateur existe réellement en base
    let authorExists = false;
    if (finalAuthorId) {
      const user = await prisma.user.findUnique({ where: { id: finalAuthorId } });
      if (user) authorExists = true;
    }

    if (!authorExists) {
      console.log(`⚠️ [FORGE_API] [${traceId}] AUTEUR_REQUIS : Initialisation ADMIN_ROOT...`);
      const systemAdmin = await prisma.user.upsert({
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
      finalAuthorId = systemAdmin.id;
    }

    // 2. GESTION DU CODE UNIQUE
    let code = (metadata?.code || `FORGE-${Date.now().toString().slice(-6)}`).toUpperCase();
    const existingCode = await prisma.procedure.findUnique({ where: { code } });
    if (existingCode) {
      code = `${code}-${Math.floor(Math.random() * 1000)}`;
    }

    // 3. TRANSACTION SQL NEON
    console.log(`💾 [FORGE_API] [${traceId}] ÉCRITURE_BDD_SQL pour ${code}...`);
    let procedure;
    try {
      procedure = await prisma.procedure.create({
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
          metadata: { ...metadata, forged_at: timestamp, traceId },
          authorId: finalAuthorId!
        }
      });
    } catch (sqlError: any) {
      console.error(`❌ [FORGE_API] [${traceId}] ERREUR_PRISMA :`, sqlError.message);
      return NextResponse.json({ 
        success: false, 
        message: `Échec SQL : ${sqlError.message || 'Contrainte violée'}`,
        traceId
      }, { status: 500 });
    }

    // 4. ARCHIVAGE PHYSIQUE (.registry/)
    try {
      const regPath = `procedures/${procedure.code.toLowerCase()}/procedure.json`;
      await postgresClient.saveFile(regPath, JSON.stringify(procedure, null, 2));
      console.log(`📂 [FORGE_API] [${traceId}] ARCHIVE_PHYSIQUE_OK`);
    } catch (e: any) {
      console.warn(`⚠️ [FORGE_API] [${traceId}] ECHEC_ARCHIVE_PHYSIQUE: ${e.message}`);
    }

    // 5. VECTORISATION IA (Background)
    procedureRAG.indexProcedure(procedure as unknown as FullProcedure).catch(err => {
      console.warn(`⚠️ [FORGE_API] [${traceId}] RAG_DELAYED: ${err.message}`);
    });

    return NextResponse.json({
      success: true,
      procedureId: procedure.id,
      message: `Procédure "${procedure.title}" forgée avec succès.`,
      traceId
    });

  } catch (error: any) {
    console.error(`❌ [FORGE_API] [${traceId}] ERREUR_FATALE :`, error.message);
    return NextResponse.json({ 
      success: false, 
      message: `Erreur critique : ${error.message}`,
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
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
