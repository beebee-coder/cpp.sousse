
/**
 * @fileOverview Désactivé pour éviter les conflits avec le système d'authentification personnalisé.
 * Toutes les requêtes de connexion sont gérées par /api/auth/signin.
 */
import { NextResponse } from 'next/server';

export async function GET() { return NextResponse.json({ message: "Utilisez /api/auth/signin" }, { status: 404 }); }
export async function POST() { return NextResponse.json({ message: "Utilisez /api/auth/signin" }, { status: 404 }); }
