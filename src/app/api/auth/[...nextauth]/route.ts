/**
 * @fileOverview Désactivé.
 * Suppression de la logique conflictuelle pour libérer le routage /api/auth.
 */
import { NextResponse } from 'next/server';

export async function GET() { return NextResponse.json({ status: 'legacy_auth_disabled' }, { status: 404 }); }
export async function POST() { return NextResponse.json({ status: 'legacy_auth_disabled' }, { status: 404 }); }
