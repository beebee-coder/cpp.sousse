
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { postgresClient } from '@/lib/db/postgres-client';
import { getSessionFromCookie } from '@/lib/session';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * Forge industrielle avec logs structurés [FORGE_API].
 */
export async function POST(request: NextRequest) {
  const ts = new Date().toLocaleTimeString();
  const traceId = uuidv4().slice(0, 8);
  
  console.log(`🚀 [FORGE_API] [INIT] [${traceId}] Demande reçue à ${ts}`);

  try {
    const session = await getSessionFromCookie();
    const body = await request.json().catch(() => null);
    
    if (!body || !body.title || !body.steps) {
      console.error(`❌ [FORGE_API] [REJECT] [${traceId}] Payload invalide.`);
      return NextResponse.json({ success: false, message: 'Données manquantes.' }, { status: 400 });
    }

    const { title, steps, metadata } = body;
    let code = (metadata?.code || `FORGE-${Date.now().toString().slice(-6)}`).toUpperCase();

    // 1. Archivage Physique
    console.log(`📂 [FORGE_API] [STEP] [${traceId}] Archivage dans le Registre Physique...`);
    try {
      const regPath = `procedures/${code.toLowerCase()}/procedure.json`;
      await postgresClient.saveFile(regPath, JSON.stringify({ ...body, forged_at: ts, traceId }, null, 2));
      console.log(`✅ [FORGE_API] [SUCCESS] [${traceId}] Fichier physique créé.`);
    } catch (e: any) {
      console.error(`❌ [FORGE_API] [ERROR] [${traceId}] Échec archivage :`, e.message);
    }

    // 2. Synchronisation SQL (Neon)
    console.log(`💾 [FORGE_API] [STEP] [${traceId}] Tentative de synchronisation SQL...`);
    try {
      let authorId = session?.user?.id;
      if (!authorId) {
        // Auto-création administrateur système si nécessaire
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

      await prisma.procedure.create({
        data: {
          code,
          title: title.trim(),
          description: body.description || 'Généré par forge industrielle.',
          category: (metadata?.category || 'OPERATION').toUpperCase(),
          department: (metadata?.department || 'PRODUCTION').toUpperCase(),
          criticality: (metadata?.criticality || 'MEDIUM').toUpperCase(),
          version: metadata?.version || '1.0.0',
          status: 'APPROVED',
          prerequisites: (body.prerequisites || { description: "Standard", items: [] }),
          steps: steps as any,
          metadata: { ...metadata, traceId },
          authorId: authorId
        }
      });
      console.log(`✅ [FORGE_API] [SUCCESS] [${traceId}] Sync Neon réussie.`);
    } catch (e: any) {
      console.warn(`⚠️ [FORGE_API] [BYPASS] [${traceId}] Sync SQL échouée (Mode physique uniquement) :`, e.message);
    }

    return NextResponse.json({ success: true, message: `Procédure "${title}" forgée.`, traceId });

  } catch (err: any) {
    console.error(`❌ [FORGE_API] [FATAL] [${traceId}] Erreur critique :`, err.message);
    return NextResponse.json({ success: false, message: err.message, traceId }, { status: 500 });
  }
}

export async function GET() {
  console.log(`🔍 [FORGE_API] [LIST] Lecture du registre.`);
  try {
    const procedures = await prisma.procedure.findMany({
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { firstName: true, lastName: true } } }
    });
    return NextResponse.json({ success: true, procedures });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}
