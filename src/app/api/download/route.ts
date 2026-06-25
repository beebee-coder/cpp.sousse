
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * API Route pour gérer le téléchargement des installateurs réels.
 * Vérifie la présence physique des binaires dans /public/installers/
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform');

  // Mapping des noms de fichiers réels générés par Tauri
  const localFileMap: Record<string, string> = {
    windows: 'VisioNode_Setup_x64.exe',
    msi: 'VisioNode_Setup_x64.msi',
    macos: 'VisioNode.dmg',
    linux: 'VisioNode.AppImage'
  };

  if (!platform || !localFileMap[platform]) {
    return NextResponse.json({ 
      error: 'PLATFORM_NOT_FOUND',
      message: 'Spécifiez une plateforme valide.'
    }, { status: 400 });
  }

  const fileName = localFileMap[platform];
  const relativePath = `installers/${fileName}`;
  const fullPath = path.join(process.cwd(), 'public', relativePath);

  // Vérification de l'existence réelle du binaire sur le serveur de prod
  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ 
      error: 'FILE_NOT_FOUND',
      message: `Le fichier ${fileName} est absent du serveur. Assurez-vous de l'avoir ajouté dans /public/installers/ avant le push.`
    }, { status: 404 });
  }

  const origin = new URL(req.url).origin;
  const downloadUrl = `${origin}/${relativePath}`;

  // Redirection vers le fichier statique
  return NextResponse.redirect(downloadUrl, 302);
}
