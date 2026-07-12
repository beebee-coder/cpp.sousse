export const dynamic = 'force-dynamic';
export const revalidate = false;

import { NextResponse } from 'next/server';

const STATIC_INSTALLERS: Record<string, string> = {
  windows: 'VisioNode_Setup_x64.exe',
  msi:     'VisioNode_Setup_x64.msi',
  // macos: 'VisioNode.dmg',      // à activer quand disponible
  // linux: 'VisioNode.AppImage', // à activer quand disponible
};

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const platform = searchParams.get('platform') ?? '';

  const filename = STATIC_INSTALLERS[platform];

  if (!filename) {
    return NextResponse.json(
      {
        error: 'PLATFORM_NOT_FOUND',
        message: `Plateforme "${platform}" non disponible. Plateformes supportées : ${Object.keys(STATIC_INSTALLERS).join(', ')}.`,
      },
      { status: 400 }
    );
  }

  // Redirection vers le fichier statique servi par Next.js depuis /public/installers/
  // Fonctionne aussi bien en local qu'en production Vercel.
  return NextResponse.redirect(`${origin}/installers/${filename}`, { status: 302 });
}
