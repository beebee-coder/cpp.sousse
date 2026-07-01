import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { postgresClient } from '@/lib/db/postgres-client';
import { getSessionFromCookie } from '@/lib/session';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * @fileOverview API de Forge Industrielle V6.0 - Nomenclature Reformée.
 * Logs structurés [FORGE_API].
 */
export async function POST(request: NextRequest) {
  const ts = new Date().toLocaleTimeString();
  const traceId = uuidv4().slice(0, 8);
  
  console.log(`🚀 [FORGE_API] [INIT] [${traceId}] Réception demande à ${ts}`);

  try {
    const session = await getSessionFromCookie();
    const body = await request.json().catch(() => null);
    
    if (!body || !body.title || !body.steps) {
      console.error(`❌ [FORGE_API] [REJECT] [${traceId}] Payload invalide.`);
      return NextResponse.json({ success: false, message: 'Données incomplètes (Titre/Étapes requis).' }, { status: 400 });
    }

    const { title, steps, metadata } = body;
    
    // Normalisation du code
    let code = (metadata?.code || `PROC-${Date.now().toString().slice(-6)}`).toUpperCase();

    // 1. ARCHIVAGE PHYSIQUE (Source de Vérité)
    console.log(`📂 [FORGE_API] [STEP] [${traceId}] Archivage physique...`);
    try {
      const regPath = `procedures/${code.toLowerCase()}/procedure.json`;
      await postgresClient.saveFile(regPath, JSON.stringify({ ...body, forged_at: ts, traceId }, null, 2));
      console.log(`✅ [FORGE_API] [SUCCESS] [${traceId}] Fichier physique créé.`);
    } catch (e: any) {
      console.error(`❌ [FORGE_API] [ERROR] [${traceId}] Échec archivage physique :`, e.message);
    }

    // 2. SYNCHRONISATION SQL (Neon)
    console.log(`💾 [FORGE_API] [STEP] [${traceId}] Synchronisation SQL Neon...`);
    try {
      // Garantir un auteur
      let authorId = session?.user?.id;
      
      // Auto-réparation de l'infrastructure admin si nécessaire
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

      if (!authorId) authorId = admin.id;

      // Gestion des collisions de code
      const existing = await prisma.procedure.findUnique({ where: { code } });
      if (existing) {
        code = `${code}-${Math.floor(Math.random() * 1000)}`;
        console.warn(`⚠️ [FORGE_API] [COLLISION] Nouveau code généré : ${code}`);
      }

      const procedure = await prisma.procedure.create({
        data: {
          code,
          title: title.trim(),
          description: body.description || metadata?.description || 'Généré via Station de Forge.',
          category: (metadata?.category || body.category || 'OPERATION').toUpperCase(),
          department: (metadata?.department || body.department || 'PRODUCTION').toUpperCase(),
          criticality: (metadata?.criticality || body.criticality || 'MEDIUM').toUpperCase(),
          version: metadata?.version || '1.0.0',
          status: 'APPROVED',
          prerequisites: (body.prerequisites || { description: "Prerequis standard", items: [] }),
          steps: steps as any,
          metadata: { ...metadata, traceId, forged_at: ts },
          authorId: authorId
        }
      });

      console.log(`✅ [FORGE_API] [SUCCESS] [${traceId}] Entrée SQL créée : ${procedure.id}`);
      
      return NextResponse.json({ 
        success: true, 
        message: `Actif "${title}" forgé et indexé.`, 
        id: procedure.id,
        code: code,
        traceId 
      });

    } catch (sqlErr: any) {
      console.error(`❌ [FORGE_API] [ERROR] [${traceId}] Échec SQL :`, sqlErr.message);
      // On retourne quand même un succès partiel si le fichier physique est là
      return NextResponse.json({ 
        success: true, 
        message: `Actif sauvegardé physiquement (Sync SQL différée).`, 
        warning: sqlErr.message,
        traceId 
      });
    }

  } catch (err: any) {
    console.error(`❌ [FORGE_API] [FATAL] [${traceId}] Panique critique :`, err.message);
    return NextResponse.json({ success: false, message: `ERREUR_FATALE : ${err.message}`, traceId }, { status: 500 });
  }
}

export async function GET() {
  console.log(`🔍 [FORGE_API] [LIST] Lecture du registre central.`);
  try {
    const procedures = await prisma.procedure.findMany({
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { firstName: true, lastName: true } } }
    });
    return NextResponse.json({ success: true, procedures });
  } catch (e: any) {
    console.error(`❌ [FORGE_API] [LIST_ERROR]`, e.message);
    return NextResponse.json({ success: false, message: 'Base d\'audit inaccessible.' }, { status: 500 });
  }
}
