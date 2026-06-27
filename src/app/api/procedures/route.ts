import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * API Route : Sauvegarde d'une procédure industrielle complète.
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

    const slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 80);

    const timestamp = Date.now();
    const dirName = `${slug}_${timestamp}`;

    const baseDir = path.join(process.cwd(), '.data', 'procedures', dirName);
    const imagesDir = path.join(baseDir, 'images');
    const videosDir = path.join(baseDir, 'videos');

    await fs.mkdir(imagesDir, { recursive: true });
    await fs.mkdir(videosDir, { recursive: true });

    const savedMedia: { stepIndex: number; type: 'image' | 'video'; filename: string }[] = [];

    if (Array.isArray(steps)) {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        if (step.imageData && typeof step.imageData === 'string' && step.imageData.startsWith('data:image')) {
          const ext = step.imageData.split(';')[0].split('/')[1] || 'jpg';
          const filename = `step-${i + 1}-image.${ext}`;
          const base64 = step.imageData.split(',')[1];
          await fs.writeFile(path.join(imagesDir, filename), Buffer.from(base64, 'base64'));
          savedMedia.push({ stepIndex: i, type: 'image', filename });
          steps[i] = { ...step, imageData: undefined, imageFile: filename };
        }

        if (step.videoData && typeof step.videoData === 'string' && step.videoData.startsWith('data:video')) {
          const ext = step.videoData.split(';')[0].split('/')[1] || 'webm';
          const filename = `step-${i + 1}-video.${ext}`;
          const base64 = step.videoData.split(',')[1];
          await fs.writeFile(path.join(videosDir, filename), Buffer.from(base64, 'base64'));
          savedMedia.push({ stepIndex: i, type: 'video', filename });
          steps[i] = { ...step, videoData: undefined, videoFile: filename };
        }
      }
    }

    const procedureData = {
      title,
      slug,
      dirName,
      steps,
      createdAt: createdAt || new Date().toISOString(),
      savedMedia,
      _physicalPath: `.data/procedures/${dirName}`,
    };

    await fs.writeFile(
      path.join(baseDir, 'procedure.json'),
      JSON.stringify(procedureData, null, 2),
      'utf8'
    );

    const registryBase = path.join(process.cwd(), '.registry', 'procedures', dirName);
    const registryImagesDir = path.join(registryBase, 'images');
    const registryVideosDir = path.join(registryBase, 'videos');
    await fs.mkdir(registryImagesDir, { recursive: true });
    await fs.mkdir(registryVideosDir, { recursive: true });

    await fs.writeFile(
      path.join(registryBase, 'procedure.json'),
      JSON.stringify(procedureData, null, 2),
      'utf8'
    );

    for (const media of savedMedia) {
      const refName = media.type === 'image'
        ? `step-${media.stepIndex + 1}-image.ref`
        : `step-${media.stepIndex + 1}-video.ref`;
      const refContent = JSON.stringify({
        filename: media.filename,
        physicalPath: `.data/procedures/${dirName}/${media.type === 'image' ? 'images' : 'videos'}/${media.filename}`,
        type: media.type,
        stepIndex: media.stepIndex,
      }, null, 2);
      const refDir = media.type === 'image' ? registryImagesDir : registryVideosDir;
      await fs.writeFile(path.join(refDir, refName), refContent, 'utf8');
    }

    console.log(`[PROCEDURE] Procédure "${title}" sauvegardée dans .data/procedures/${dirName}`);

    return NextResponse.json({
      success: true,
      message: `Procédure "${title}" enregistrée avec succès.`,
      dirName: dirName,
      mediaCount: savedMedia.length
    });

  } catch (error) {
    console.error('[PROCEDURE_API] Erreur lors de la sauvegarde:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Erreur interne serveur.' },
      { status: 500 }
    );
  }
}

/**
 * Liste toutes les procédures sauvegardées.
 */
export async function GET() {
  try {
    const proceduresDir = path.join(process.cwd(), '.data', 'procedures');

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
        const data = JSON.parse(raw);
        procedures.push({ ...data, dirName: dir });
      } catch {
        // Répertoire incomplet, on passe
      }
    }

    procedures.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ success: true, procedures });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Erreur lecture des procédures.' },
      { status: 500 }
    );
  }
}