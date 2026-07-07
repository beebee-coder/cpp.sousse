// src/lib/cors.ts
import { NextResponse } from 'next/server';

/**
 * @fileOverview Helpers CORS pour permettre au client Tauri (origine locale)
 * d'appeler l'API déployée sur Vercel (origine distante) en cross-origin.
 *
 * En web (même origine) ces en-têtes sont inoffensifs.
 * En desktop, l'origine de la webview est echoée pour autoriser les cookies
 * (withCredentials) requis par l'authentification.
 */

export function corsHeaders(origin?: string | null): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/** Répond à une requête preflight OPTIONS. */
export function corsPreflight(origin?: string | null): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

/** Ajoute les en-têtes CORS à une réponse existante. */
export function withCors(response: NextResponse, origin?: string | null): NextResponse {
  const headers = corsHeaders(origin);
  (Object.entries(headers) as [string, string][]).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}
