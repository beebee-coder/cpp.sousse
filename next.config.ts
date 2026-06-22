
import type { NextConfig } from 'next';

const isDesktop = process.env.TAURI_ENV === 'true';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Modules natifs lourds à exclure strictement du bundle d'exécution
  serverExternalPackages: [
    'onnxruntime-node', 
    '@huggingface/transformers', 
    'chromadb', 
    'groq-sdk',
    'weaviate-client',
    'sharp'
  ],

  // Mode export pour Tauri, standard pour Vercel
  output: isDesktop ? 'export' : undefined,
  
  images: {
    // Désactivation de l'optimisation pour éviter les timeouts sur les placeholders externes (Picsum/Unsplash)
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

  // Désactivation des sourcemaps en production pour gagner de l'espace
  productionBrowserSourceMaps: false,
};

export default nextConfig;
