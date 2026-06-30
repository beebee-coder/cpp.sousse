
import type { NextConfig } from 'next';

const isDesktop = process.env.TAURI_ENV === 'true';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // En mode Desktop (Tauri), on force l'export statique. 
  output: isDesktop ? 'export' : undefined,
  
  // Modules natifs et lourds à exclure strictement du bundle d'exécution pour éviter les erreurs de compilation.
  // serverExternalPackages remplace avantageusement les externals Webpack manuels dans Next.js 14/15.
  serverExternalPackages: [
    'onnxruntime-node', 
    'chromadb', 
    'groq-sdk',
    'weaviate-client',
    'sharp',
    'canvas',
    'jsdom',
    'bufferutil',
    'utf-8-validate'
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
  
  // Suppression du bloc webpack: (config) => { ... } car il faisait double emploi 
  // avec serverExternalPackages, ce qui provoquait des instabilités au démarrage.
};

export default nextConfig;
