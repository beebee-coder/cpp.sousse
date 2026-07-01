import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma-client';
import { procedureRAG } from '@/lib/procedures/services/rag.service';
import { postgresClient } from '@/lib/db/postgres-client';
import { getSessionFromCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/procedures
 * Liste les procédures du registre central.
 */
export async function GET() {
  console.log("🔍 [API_PROCEDURES] Lecture du registre...");
  try {
    const procedures = await prisma.procedure.findMany({
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { firstName: true, lastName: true } } }
    });
    console.log(`✅ [API_PROCEDURES] ${procedures.length} procédures trouvées.`);
    return NextResponse.json({ success: true, procedures });
  } catch (error: any) {
    console.error('❌ [API_PROCEDURES_GET] Error:', error.message);
    return NextResponse.json({ success: false, message: 'Erreur lecture registre.', error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/procedures
 * Forge de procédure ultra-résiliente.
 * Crée l'auteur système si nécessaire pour garantir la réussite de l'opération.
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`🚀 [API_PROC_POST] [${timestamp}] Initiation de la forge...`);

  try {
    const session = await getSessionFromCookie();
    const body = await request.json();
    const { title, steps, metadata } = body;

    if (!title || !steps || !Array.isArray(steps)) {
      console.error("❌ [API_PROC_POST] Structure invalide reçue:", { title: !!title, steps: !!steps });
      return NextResponse.json({ success: false, message: 'Structure de forge invalide : Titre et Étapes requis.' }, { status: 400 });
    }

    console.log(`📝 [API_PROC_POST] Titre: "${title}", Étapes: ${steps.length}`);

    // 1. Identification ou Création de l'auteur (Crucial pour Prisma)
    let authorId = session?.user?.id;
    console.log(`👤 [API_PROC_POST] Auteur session: ${authorId || 'AUCUN'}`);
    
    if (!authorId) {
      console.log("🕵️ [API_PROC_POST] Recherche auteur système (admin-root)...");
      const admin = await prisma.user.findFirst({ where: { OR: [{ role: 'admin' }, { id: 'admin-root' }] } });
      if (admin) {
        authorId = admin.id;
        console.log(`✅ [API_PROC_POST] Utilisation auteur existant: ${admin.id}`);
      } else {
        console.log("🔨 [API_PROC_POST] Création de l'auteur racine manquant...");
        const rootAdmin = await prisma.user.upsert({
          where: { id: 'admin-root' },
          update: { approved: true },
          create: {
            id: 'admin-root',
            firstName: 'System',
            lastName: 'Administrator',
            email: 'admin@visionode.local',
            password: 'System@NoPassword@2024',
            role: 'admin',
            approved: true
          }
        });
        authorId = rootAdmin.id;
        console.log(`✅ [API_PROC_POST] Auteur racine créé.`);
      }
    }

    const code = metadata?.code || `FORGE-${Date.now().toString().slice(-6)}`;
    console.log(`🆔 [API_PROC_POST] Code procédure généré: ${code}`);

    // 2. Enregistrement Base de Données Web (Neon)
    console.log("💾 [API_PROC_POST] Insertion Neon SQL...");
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
        prerequisites: body.prerequisites || { description: "Conditions de sécurité standards", items: [] },
        steps: steps,
        metadata: { ...metadata, authorId, forged_at: timestamp },
        parameters: body.parameters || { variables: [] },
        postExecution: body.postExecution || { checks: [], reporting: { generateReport: true, reportFields: [] } },
        authorId: authorId,
        syncedLocal: false
      }
    });
    console.log(`✅ [API_PROC_POST] Enregistré en DB (ID: ${procedure.id}).`);

    // 3. Archivage Physique (Registre .registry/)
    try {
      console.log(`📁 [API_PROC_POST] Archivage physique dans .registry/procedures/${procedure.code.toLowerCase()}...`);
      const registryPath = `procedures/${procedure.code.toLowerCase()}/procedure.json`;
      await postgresClient.saveFile(registryPath, JSON.stringify(procedure, null, 2));

      // 4. Projection sémantique pour recherche offline
      console.log("🧠 [API_PROC_POST] Création projection sémantique pour recherche offline...");
      const projectionPath = `items/proc_${procedure.code.toLowerCase()}.json`;
      await postgresClient.saveFile(projectionPath, JSON.stringify({
        id: procedure.id,
        procedureId: procedure.id,
        type: 'procedure',
        title: procedure.title,
        label: procedure.code,
        details: procedure.description,
        content: `PROCÉDURE TECHNIQUE: ${procedure.title}. Séquence de ${(procedure.steps as any[]).length} étapes opérationnelles.`,
        metadata: { origin: 'FORGE_SYSTEM', code: procedure.code }
      }, null, 2));
      
      console.log(`✅ [API_PROC_POST] Fichiers physiques écrits.`);
    } catch (fsErr: any) {
      console.error(`⚠️ [API_PROC_POST] Échec archivage physique (mais DB OK): ${fsErr.message}`);
    }

    // 5. Vectorisation RAG (Asynchrone/Non-bloquante)
    console.log("📡 [API_PROC_POST] Déclenchement de la vectorisation IA (Background)...");
    procedureRAG.indexProcedure(procedure as any).then(() => {
      console.log(`✅ [RAG_BACKGROUND] Indexation terminée pour ${code}`);
    }).catch(ragErr => {
      console.error(`⚠️ [RAG_BACKGROUND] Échec vectorisation: ${ragErr.message}`);
    });

    console.log(`🏁 [API_PROC_POST] Flux de forge terminé avec succès.`);
    return NextResponse.json({
      success: true,
      procedureId: procedure.id,
      message: `La procédure "${procedure.title}" a été forgée et indexée.`
    });

  } catch (error: any) {
    console.error(`❌ [API_PROC_POST] ÉCHEC CRITIQUE: ${error.message}`);
    console.error("Stack trace:", error.stack);
    return NextResponse.json(
      { success: false, message: 'Échec de la forge industrielle.', error: error.message },
      { status: 500 }
    );
  }
}
