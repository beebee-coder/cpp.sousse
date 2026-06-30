import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * API Route : Sauvegarde d'une procédure industrielle complète.
 * Optimisée pour stocker les médias physiquement dans le Registre.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, steps, createdAt } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Titre de procédure requis.' },
        { status: 400 }
      );
    }

    // Log de diagnostic pour le suivi de la charge
    const payloadSize = JSON.stringify(body).length;
    console.log(`[PROCEDURE_API] Réception procédure: "${title}". Taille estimée: ${(payloadSize / 1024 / 1024).toFixed(2)} MB`);

    const slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 80) || 'sans-titre';

    const timestamp = Date.now();
    const dirName = `${slug}_${timestamp}`;

    // On utilise uniquement .registry pour la visibilité immédiate dans l'explorateur
    const registryBase = path.join(process.cwd(), '.registry', 'procedures', dirName);
    const imagesDir = path.join(registryBase, 'images');
    const videosDir = path.join(registryBase, 'videos');

    // Création récursive des répertoires
    await fs.mkdir(imagesDir, { recursive: true });
    await fs.mkdir(videosDir, { recursive: true });

    const savedMedia: { stepIndex: number; type: 'image' | 'video'; filename: string }[] = [];
    const processedSteps = Array.isArray(steps) ? [...steps] : [];

    // Extraction et sauvegarde des fichiers binaires pour alléger le JSON
    for (let i = 0; i < processedSteps.length; i++) {
      const step = processedSteps[i];

      if (step.imageData && typeof step.imageData === 'string' && step.imageData.startsWith('data:image')) {
        const ext = step.imageData.split(';')[0].split('/')[1] || 'jpg';
        const filename = `step-${i + 1}-image.${ext}`;
        const base64 = step.imageData.split(',')[1];
        await fs.writeFile(path.join(imagesDir, filename), Buffer.from(base64, 'base64'));
        savedMedia.push({ stepIndex: i, type: 'image', filename });
        // On remplace la donnée lourde par une référence
        processedSteps[i] = { ...step, imageData: undefined, imageRef: `images/${filename}` };
      }

      if (step.videoData && typeof step.videoData === 'string' && step.videoData.startsWith('data:video')) {
        const ext = step.videoData.split(';')[0].split('/')[1] || 'webm';
        const filename = `step-${i + 1}-video.${ext}`;
        const base64 = step.videoData.split(',')[1];
        await fs.writeFile(path.join(videosDir, filename), Buffer.from(base64, 'base64'));
        savedMedia.push({ stepIndex: i, type: 'video', filename });
        // On remplace la donnée lourde par une référence
        processedSteps[i] = { ...step, videoData: undefined, videoRef: `videos/${filename}` };
      }
    }

    const procedureData = {
      title,
      slug,
      dirName,
      steps: processedSteps,
      createdAt: createdAt || new Date().toISOString(),
      metadata: {
        mediaCount: savedMedia.length,
        version: "2.0",
        author: "admin_station"
      }
    };

    // Sauvegarde du fichier descriptif central
    await fs.writeFile(
      path.join(registryBase, 'procedure.json'),
      JSON.stringify(procedureData, null, 2),
      'utf8'
    );

    console.log(`[PROCEDURE_API] ✅ Procédure enregistrée avec succès dans: .registry/procedures/${dirName}`);

    return NextResponse.json({
      success: true,
      message: `Procédure "${title}" enregistrée avec ${savedMedia.length} média(s).`,
      dirName: dirName,
      mediaCount: savedMedia.length
    });

  } catch (error: any) {
    console.error('[PROCEDURE_API] ❌ Échec enregistrement:', error.message);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Erreur lors de l\'écriture disque.',
        error: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * Liste toutes les procédures du registre.
 */
export async function GET() {
  try {
    const proceduresDir = path.join(process.cwd(), '.registry', 'procedures');

    try {
      await fs.access(proceduresDir);
    } catch {
      return NextResponse.json({ success: true, procedures: [] });
    }

    const dirs = await fs.readdir(proceduresDir);
    const procedures = [];

    for (const dir of dirs) {
      try {
        const jsonPath = path.join(proceduresDir, dir, 'procedure.json');
        const raw = await fs.readFile(jsonPath, 'utf8');
        procedures.push(JSON.parse(raw));
      } catch {
        // Dossier vide ou corrompu ignoré
      }
    }

    procedures.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ success: true, procedures });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Erreur lecture registre.' }, { status: 500 });
  }
}
