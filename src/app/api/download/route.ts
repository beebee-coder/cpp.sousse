
import { NextResponse } from 'next/server';

/**
 * API Route pour rediriger vers les installateurs.
 * En production, redirige vers un bucket S3/Firebase Storage pour éviter de saturer Vercel.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform');

  // Placeholder links pour les installateurs
  // À remplacer par vos liens de stockage cloud réels
  const storageMap: Record<string, string> = {
    windows: 'https://github.com/beebee-coder/cpp.sousse/releases/latest/download/VisioNode_Setup_x64.exe',
    macos: 'https://github.com/beebee-coder/cpp.sousse/releases/latest/download/VisioNode.dmg',
    linux: 'https://github.com/beebee-coder/cpp.sousse/releases/latest/download/VisioNode.AppImage'
  };

  const downloadUrl = platform ? storageMap[platform] : null;

  if (downloadUrl) {
    return NextResponse.redirect(downloadUrl);
  }

  return NextResponse.json({ 
    error: 'PLATFORM_NOT_FOUND',
    message: 'Installateur non disponible pour cette plateforme.'
  }, { status: 404 });
}
