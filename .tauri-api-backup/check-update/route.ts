export const dynamic = 'force-dynamic';
export const revalidate = false;

import { NextResponse } from 'next/server';

/**
 * Endpoint de vérification des mises à jour pour l'application Desktop.
 */
export async function GET() {
  // Simule une réponse de version actuelle
  return NextResponse.json({
    latestVersion: '1.0.0',
    critical: false,
    releaseDate: new Date().toISOString(),
    notes: 'Initial stable release of VisioNode Precision Engine.',
    links: {
      windows: '/api/download?platform=windows',
      macos: '/api/download?platform=macos',
      linux: '/api/download?platform=linux'
    }
  });
}
