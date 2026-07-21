import { NextResponse } from 'next/server';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = false;

const MANIFEST_PATH = path.join(process.cwd(), 'public', 'installers', 'installers.json');

export async function POST() {
  try {
    const manifestRaw = await import('node:fs').then(fs => fs.readFileSync(MANIFEST_PATH, 'utf8')).catch(() => null);
    if (!manifestRaw) {
      return NextResponse.json({ success: false, error: 'Manifeste des installateurs introuvable.' }, { status: 500 });
    }

    const manifest = JSON.parse(manifestRaw);
    const exeUrl = manifest?.windows?.exe;

    if (!exeUrl) {
      return NextResponse.json({ success: false, error: 'URL de l\'installateur Windows introuvable dans le manifeste.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Mise à jour disponible.',
      downloadUrl: exeUrl,
    });

  } catch (error: any) {
    console.error('❌ [UPDATE] Erreur inattendue:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
