
import type { NextConfig } from 'next';

const isDesktop = process.env.TAURI_ENV === 'true';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Modules natifs et lourds à exclure strictement du bundle d'exécution Serverless
  // Cette liste garantit que le déploiement sur Vercel reste sous les 250 Mo.
  serverExternalPackages: [
    'onnxruntime-node', 
    '@huggingface/transformers', 
    'chromadb', 
    'groq-sdk',
    'weaviate-client',
    'sharp',
    'canvas',
    'jsdom',
    'bufferutil',
    'utf-8-validate'
  ],

  // Mode export pour Tauri (Statique), standard pour Vercel (Dynamique)
  output: isDesktop ? 'export' : undefined,
  
  // Ignore les API routes (.ts) en mode Desktop car Tauri ne supporte pas le serveur Next.js
  ...(isDesktop && { pageExtensions: ['tsx', 'jsx', 'js'] }),
  
  images: {
    // Désactivation de l'optimisation pour éviter les timeouts serveur sur les placeholders
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  
  typescript: {
    ignoreBuildErrors: true,
  },
  
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Désactivation des sourcemaps en production pour économiser de l'espace disque
  productionBrowserSourceMaps: false,
};

export default nextConfig;
