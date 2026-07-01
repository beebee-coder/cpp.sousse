import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { procedureRAG } from '@/lib/procedures/services/rag.service';
import { postgresClient } from '@/lib/db/postgres-client';
import { getSessionFromCookie } from '@/lib/session';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * POST /api/procedures
 * Forge de procédure ultra-résiliente.
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const traceId = uuidv4().slice(0, 8);
  
  try {
    const session = await getSessionFromCookie();
    const body = await request.json().catch(() => null);
    
    if (!body || !body.title || !body.steps || !Array.isArray(body.steps)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Structure invalide : Titre et Étapes requis.',
        traceId 
      }, { status: 400 });
    }

    const { title, steps, metadata } = body;

    // 1. Validation de l'Auteur
    let finalAuthorId: string | null = null;
    if (session?.user?.id) {
      const userExists = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (userExists) finalAuthorId = session.user.id;
    }

    if (!finalAuthorId) {
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

    // 2. Code unique
    let code = metadata?.code || `FORGE-${Date.now().toString().slice(-6)}`;
    const existingProc = await prisma.procedure.findUnique({ where: { code } });
    if (existingProc) code = `${code}-${Math.floor(Math.random() * 1000)}`;

    const procId = uuidv4();

    // 3. Enregistrement Neon SQL
    const procedure = await prisma.procedure.create({
      data: {
        id: procId,
        code,
        title: title.trim(),
        description: body.description || metadata?.description || 'Procédure générée via Station de Dictée.',
        category: String(metadata?.category || 'OPERATION').toUpperCase(),
        department: String(metadata?.department || 'PRODUCTION').toUpperCase(),
        criticality: String(metadata?.criticality || 'MEDIUM').toUpperCase(),
        version: metadata?.version || '1.0.0',
        status: 'APPROVED',
        prerequisites: (body.prerequisites || { description: "Sécurité standard", items: [] }) as any,
        steps: steps as any,
        metadata: { ...metadata, authorId: finalAuthorId, traceId, forged_at: timestamp } as any,
        parameters: (body.parameters || { variables: [] }) as any,
        postExecution: (body.postExecution || { checks: [], reporting: { generateReport: true, reportFields: [] } }) as any,
        authorId: finalAuthorId,
        syncedLocal: false
      }
    });

    // 4. Archivage Physique
    try {
      const registryPath = `procedures/${procedure.code.toLowerCase()}/procedure.json`;
      await postgresClient.saveFile(registryPath, JSON.stringify(procedure, null, 2));

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
    } catch (fsErr) {
      console.warn("⚠️ Échec archivage FS (non-bloquant)");
    }

    // 5. Vectorisation
    procedureRAG.indexProcedure(procedure as any).catch(() => {});

    return NextResponse.json({
      success: true,
      procedureId: procedure.id,
      message: `Procédure "${procedure.title}" forgée avec succès.`,
      traceId
    });

  } catch (error: any) {
    console.error(`❌ [FORGE_FATAL]`, error.message);
    return NextResponse.json({ success: false, message: 'Échec du service de forge.', error: error.message, traceId }, { status: 500 });
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
