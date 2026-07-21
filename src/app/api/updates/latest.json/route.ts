export const dynamic = 'force-dynamic';
export const revalidate = false;

import { NextResponse } from 'next/server';
import path from 'path';

const LATEST_JSON_PATH = path.join(process.cwd(), 'public', 'installers', 'latest.json');

export async function GET() {
  try {
    const fs = await import('node:fs');
    if (!fs.existsSync(LATEST_JSON_PATH)) {
      return NextResponse.json({ error: 'Update manifest not found' }, { status: 404 });
    }
    const raw = fs.readFileSync(LATEST_JSON_PATH, 'utf8');
    const data = JSON.parse(raw);
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error('[UPDATES] Failed to serve manifest:', error);
    return NextResponse.json({ error: 'Failed to load update manifest' }, { status: 500 });
  }
}
