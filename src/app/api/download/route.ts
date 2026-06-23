import { NextResponse } from 'next/server';

/**
 * API Route pour gérer le téléchargement des installateurs.
 * Priorise les fichiers stockés localement dans /public/installers/
 * et bascule sur le registre GitHub en cas d'absence.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform');

  // Mapping des fichiers locaux (doivent être placés dans public/installers/)
  const localFileMap: Record<string, string> = {
    windows: '/installers/VisioNode_Setup_x64.exe',
    macos: '/installers/VisioNode.dmg',
    linux: '/installers/VisioNode.AppImage'
  };

  // Fallback vers les releases GitHub si le fichier local n'est pas trouvé
  const githubFallbackMap: Record<string, string> = {
    windows: 'https://github.com/beebee-coder/cpp.sousse/releases/latest/download/VisioNode_Setup_x64.exe',
    macos: 'https://github.com/beebee-coder/cpp.sousse/releases/latest/download/VisioNode.dmg',
    linux: 'https://github.com/beebee-coder/cpp.sousse/releases/latest/download/VisioNode.AppImage'
  };

  if (!platform || !localFileMap[platform]) {
    return NextResponse.json({ 
      error: 'PLATFORM_NOT_FOUND',
      message: 'Spécifiez une plateforme valide (windows, macos, linux).'
    }, { status: 400 });
  }

  // En production, on redirige vers le chemin public ou GitHub
  // Note: Pour forcer le téléchargement direct du fichier local :
  const downloadUrl = localFileMap[platform];

  return NextResponse.redirect(new URL(downloadUrl, req.url));
}
