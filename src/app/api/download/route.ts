
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * API Route pour gérer le téléchargement des installateurs.
 * Vérifie la présence physique du fichier sur le serveur avant redirection.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform');

  // Mapping des noms de fichiers attendus dans /public/installers/
  const localFileMap: Record<string, string> = {
    windows: 'VisioNode_Setup_x64.exe',
    macos: 'VisioNode.dmg',
    linux: 'VisioNode.AppImage'
  };

  if (!platform || !localFileMap[platform]) {
    return NextResponse.json({ 
      error: 'PLATFORM_NOT_FOUND',
      message: 'Spécifiez une plateforme valide (windows, macos, linux).'
    }, { status: 400 });
  }

  const fileName = localFileMap[platform];
  const relativePath = `installers/${fileName}`;
  const fullPath = path.join(process.cwd(), 'public', relativePath);

  console.log(`🚀 [DISTRIBUTION] Requête pour ${platform} -> ${fullPath}`);

  // Vérification de l'existence du binaire
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️ [DISTRIBUTION] Fichier absent du disque : ${fileName}`);
    return NextResponse.json({ 
      error: 'FILE_NOT_FORGED',
      message: `L'installateur pour ${platform} (${fileName}) n'est pas encore disponible. Il doit être généré via la Station de Forge en local.`
    }, { status: 404 });
  }

  const origin = new URL(req.url).origin;
  const downloadUrl = `${origin}/${relativePath}`;

  // Redirection 302 vers le fichier statique
  return NextResponse.redirect(downloadUrl, 302);
}
