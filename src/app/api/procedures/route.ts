export const dynamic = 'force-dynamic';
export const revalidate = false;
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { postgresClient } from '@/lib/db/postgres-client';
import { getSessionFromCookie } from '@/lib/session';
import { v4 as uuidv4 } from 'uuid';
import { FullProcedure, ProcedureMetadata } from '@/lib/procedures/types';
import { procedureManager } from '@/lib/procedures/services/procedure-manager.service';
import { CreateProcedureSchema } from '@/lib/procedures/validators/procedure.validator';


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

    const parsed = CreateProcedureSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: 'Validation échouée', errors: parsed.error.flatten() }, { status: 400 });
    }

    const title = parsed.data.title;
    const metadata: Partial<ProcedureMetadata> = parsed.data.metadata || {};
    const code = (metadata.code || parsed.data.code || `PROC-${Date.now().toString().slice(-6)}`).toUpperCase();

    const authorId = session?.user?.id || (await getFallbackAdmin())?.id || 'admin-root';

    const procedure = await procedureManager.create(parsed.data, authorId);

    return NextResponse.json({ 
      success: true, 
      message: `Actif "${title}" forgé avec succès.`, 
      code: procedure.code,
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

async function getFallbackAdmin() {
  try {
    return await prisma.user.findFirst({ where: { role: 'admin' } });
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Non autorisé.' }, { status: 401 });
    }
    const procedures = await procedureManager.list({});
    return NextResponse.json({ success: true, procedures });
  } catch (error: unknown) {
    const e = error as Error;
    console.error(`❌ [FORGE] [READ_ERROR]`, e.message);
    return NextResponse.json({ success: false, procedures: [], message: 'Mode Registre Physique actif.' });
  }
}
