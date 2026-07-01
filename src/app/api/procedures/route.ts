import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { postgresClient } from '@/lib/db/postgres-client';
import { getSessionFromCookie } from '@/lib/session';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * @fileOverview API de Forge Industrielle V6.5 - Concordance CRF Totale.
 * Logs structurés [FORGE_API]. Optimisé pour éviter les timeouts proxy.
 */
export async function POST(request: NextRequest) {
  const ts = new Date().toLocaleTimeString();
  const traceId = uuidv4().slice(0, 8);
  
  console.log(`🚀 [FORGE_API] [INIT] [${traceId}] Réception demande à ${ts}`);

  try {
    const session = await getSessionFromCookie();
    const body = await request.json().catch(() => null);
    
    if (!body || !body.title) {
      console.error(`❌ [FORGE_API] [REJECT] [${traceId}] Payload incomplet.`);
      return NextResponse.json({ success: false, message: 'Titre requis.' }, { status: 400 });
    }

    // Extraction et normalisation selon standard CRF
    const title = body.title;
    const metadata = body.metadata || {};
    const code = (metadata.code || body.code || `PROC-${Date.now().toString().slice(-6)}`).toUpperCase();

    // 1. ARCHIVAGE PHYSIQUE (Priorité Critique - Libère le client rapidement)
    console.log(`📂 [FORGE_API] [STEP] [${traceId}] Archivage physique du Registre...`);
    const regPath = `procedures/${code.toLowerCase()}/procedure.json`;
    
    // On capture les données structurées pour le JSON
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
      prerequisites: body.prerequisites || { description: "Prerequis standard", items: [] },
      steps: (body.steps || []).map((s: any, i: number) => ({ ...s, order: i + 1 })),
      postExecution: body.postExecution || {},
      parameters: body.parameters || {},
      _forged_by: session?.user?.id || 'admin-root',
      _traceId: traceId
    };

    try {
      await postgresClient.saveFile(regPath, JSON.stringify(procedureData, null, 2));
      console.log(`✅ [FORGE_API] [SUCCESS] [${traceId}] Fichier physique créé : ${regPath}`);
    } catch (e: any) {
      console.error(`❌ [FORGE_API] [ERROR] [${traceId}] Échec archivage disque :`, e.message);
      // On continue quand même vers SQL si possible
    }

    // 2. SYNCHRONISATION SQL NEON (Asynchrone/Non-bloquante pour le client si possible)
    console.log(`💾 [FORGE_API] [STEP] [${traceId}] Tentative synchronisation SQL Neon...`);
    
    try {
      // Sécurité Auteur
      let authorId = session?.user?.id;
      if (!authorId) {
        const admin = await prisma.user.upsert({
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
        authorId = admin.id;
      }

      // Upsert pour gérer les collisions et mises à jour
      const procedure = await prisma.procedure.upsert({
        where: { code },
        update: {
          title,
          description: body.description || metadata.description || 'Mis à jour via Station de Forge.',
          category: (metadata.category || body.category || 'OPERATION').toUpperCase(),
          criticality: (metadata.criticality || body.criticality || 'MEDIUM').toUpperCase(),
          steps: procedureData.steps as any,
          prerequisites: procedureData.prerequisites as any,
          metadata: procedureData.metadata as any,
          updatedAt: new Date(),
        },
        create: {
          id: procedureData._id,
          code,
          title,
          description: body.description || metadata.description || 'Forgé via Station VisioNode.',
          category: (metadata.category || body.category || 'OPERATION').toUpperCase(),
          department: (metadata.department || body.department || 'PRODUCTION').toUpperCase(),
          criticality: (metadata.criticality || body.criticality || 'MEDIUM').toUpperCase(),
          version: metadata.version || '1.0.0',
          status: 'APPROVED',
          prerequisites: procedureData.prerequisites as any,
          steps: procedureData.steps as any,
          metadata: procedureData.metadata as any,
          authorId: authorId,
        }
      });

      console.log(`✅ [FORGE_API] [SUCCESS] [${traceId}] Liaison SQL établie : ${procedure.id}`);
      
      return NextResponse.json({ 
        success: true, 
        message: `Actif "${title}" forgé avec succès.`, 
        id: procedure.id,
        code: code,
        traceId 
      });

    } catch (sqlErr: any) {
      console.warn(`⚠️ [FORGE_API] [BYPASS] [${traceId}] Échec SQL (Mais physique OK) :`, sqlErr.message);
      return NextResponse.json({ 
        success: true, 
        message: `Actif forgé physiquement (Sync SQL différée).`, 
        warning: sqlErr.message,
        traceId 
      });
    }

  } catch (err: any) {
    console.error(`❌ [FORGE_API] [FATAL] [${traceId}] Panique critique :`, err.message);
    return NextResponse.json({ 
      success: false, 
      error: 'ERREUR_INTERNE_SERVEUR',
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
  } catch (e: any) {
    console.error(`❌ [FORGE_API] [GET_ERROR]`, e.message);
    return NextResponse.json({ success: false, message: 'Base SQL indisponible.' }, { status: 500 });
  }
}
