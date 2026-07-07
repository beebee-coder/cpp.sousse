export const dynamic = 'force-dynamic';
export const revalidate = false;
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { postgresClient } from '@/lib/db/postgres-client';
import { getSessionFromCookie } from '@/lib/session';
import { v4 as uuidv4 } from 'uuid';
import { FullProcedure, ProcedureMetadata } from '@/lib/procedures/types';


/**
 * @fileOverview API de Forge Industrielle V6.7 - Concordance CRF & Réponse Rapide.
 * Logs structurés [FORGE]. Priorité au Registre Physique.
 */
export async function POST(request: NextRequest) {
  const ts = new Date().toLocaleTimeString();
  const traceId = uuidv4().slice(0, 8);
  
  console.log(`🚀 [FORGE] [INIT] [${traceId}] Réception demande de création à ${ts}`);

  try {
    const session = await getSessionFromCookie();
    const body = await request.json().catch(() => null);
    
    if (!body || !body.title) {
      console.error(`❌ [FORGE] [REJECT] [${traceId}] Payload incomplet.`);
      return NextResponse.json({ success: false, message: 'Titre requis.' }, { status: 400 });
    }

    const title = body.title;
    const metadata: Partial<ProcedureMetadata> = body.metadata || {};
    const code = (metadata.code || body.code || `PROC-${Date.now().toString().slice(-6)}`).toUpperCase();

    // 1. ARCHIVAGE PHYSIQUE (Priorité Critique)
    console.log(`📂 [REGISTRY] [STEP] [${traceId}] Archivage dans .registry/procedures/${code.toLowerCase()}`);
    const regPath = `procedures/${code.toLowerCase()}/procedure.json`;
    
    const procedureData = {
      _id: body.id || uuidv4(),
      _version: metadata.version || "1.0.0",
      _type: "industrial_procedure",
      metadata: {
        ...metadata,
        title,
        code,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      },
      prerequisites: body.prerequisites || { description: "Audit standard", items: [] },
      steps: (body.steps || []).map((s: any, i: number) => ({ ...s, order: i + 1 })),
      postExecution: body.postExecution || {},
      parameters: body.parameters || {},
      _forged_by: session?.user?.id || 'admin-root',
      _traceId: traceId
    };

    try {
      await postgresClient.saveFile(regPath, JSON.stringify(procedureData, null, 2));
      console.log(`✅ [REGISTRY] [SUCCESS] [${traceId}] Fichier JSON créé.`);
    } catch (error: unknown) {
      const e = error as Error;
      console.warn(`⚠️ [REGISTRY] [ERROR] [${traceId}] Échec archivage disque :`, e.message);
    }

    // 2. SYNCHRONISATION SQL NEON (Asynchrone)
    console.log(`💾 [FORGE] [STEP] [${traceId}] Tentative liaison SQL Neon...`);
    
    try {
      let authorId = session?.user?.id;
      if (!authorId) {
        const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
        authorId = admin?.id || 'admin-root';
      }

      await prisma.procedure.upsert({
        where: { code },
        update: {
          title,
          description: body.description || metadata.description || 'Mis à jour via Station de Forge.',
          steps: procedureData.steps as any,
          prerequisites: procedureData.prerequisites as any,
          updatedAt: new Date(),
        },
        create: {
          id: procedureData._id,
          code,
          title,
          description: body.description || metadata.description || 'Forgé via Station VisioNode.',
          category: (metadata.category || 'OPERATION').toUpperCase(),
          criticality: (metadata.criticality || 'MEDIUM').toUpperCase(),
          status: 'APPROVED',
          prerequisites: procedureData.prerequisites as any,
          steps: procedureData.steps as any,
          authorId: authorId,
        }
      });
      console.log(`✅ [FORGE] [SUCCESS] [${traceId}] Liaison SQL établie.`);
    } catch (error: unknown) {
      const sqlErr = error as Error;
      console.error(`🛡️ [FORGE] [BYPASS_SQL] [${traceId}] SQL non critique ignoré :`, sqlErr.message);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Actif "${title}" forgé avec succès.`, 
      code: code,
      traceId 
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error(`❌ [FORGE] [FATAL] [${traceId}] Panique :`, err.message);
    return NextResponse.json({ 
      success: false, 
      error: 'ERREUR_INTERNE_FORGE',
      message: err.message 
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
  } catch (error: unknown) {
    const e = error as Error;
    console.error(`❌ [FORGE] [READ_ERROR]`, e.message);
    return NextResponse.json({ success: false, procedures: [], message: 'Mode Registre Physique actif.' });
  }
}

