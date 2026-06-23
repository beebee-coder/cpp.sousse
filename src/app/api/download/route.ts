import { NextResponse } from 'next/server';

/**
 * API Route pour gérer le téléchargement des installateurs.
 * Priorise les fichiers stockés localement dans /public/installers/
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform');

  // Mapping des fichiers locaux (dans public/installers/)
  const localFileMap: Record<string, string> = {
    windows: '/installers/VisioNode_Setup_x64.exe',
    macos: '/installers/VisioNode.dmg',
    linux: '/installers/VisioNode.AppImage'
  };

  if (!platform || !localFileMap[platform]) {
    return NextResponse.json({ 
      error: 'PLATFORM_NOT_FOUND',
      message: 'Spécifiez une plateforme valide (windows, macos, linux).'
    }, { status: 400 });
  }

  const filePath = localFileMap[platform];
  const origin = new URL(req.url).origin;
  const downloadUrl = `${origin}${filePath}`;

  console.log(`🚀 [DISTRIBUTION] Requête de téléchargement pour ${platform} -> ${downloadUrl}`);

  // Redirection 302 vers le fichier statique pour forcer le téléchargement par le navigateur
  // On utilise une URL absolue pour éviter les erreurs de routage Next.js
  return NextResponse.redirect(downloadUrl, 302);
}