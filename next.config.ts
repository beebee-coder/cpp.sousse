import type { NextConfig } from 'next';

const isDesktop = process.env.TAURI_ENV === 'true';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // En mode Desktop (Tauri), on force l'export statique. 
  output: isDesktop ? 'export' : undefined,
  
  // Modules natifs et lourds à exclure strictement du bundle d'exécution pour éviter les erreurs de compilation.
  serverExternalPackages: [
    'onnxruntime-node', 
    'chromadb', 
    'groq-sdk',
    'weaviate-client',
    'sharp',
    'canvas',
    'jsdom',
    'bufferutil',
    'utf-8-validate',
    'prisma',
    '@prisma/client'
  ],
  
  images: {
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

  productionBrowserSourceMaps: false,
};

export default nextConfig;
