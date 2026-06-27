import type { NextConfig } from 'next';

const isDesktop = process.env.TAURI_ENV === 'true';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // En mode Desktop (Tauri), on a besoin de fichiers statiques (export)
  // En mode Web, on laisse Next.js gérer le rendu dynamique par défaut
  distDir: isDesktop ? 'out' : '.next',

  output: isDesktop ? 'export' : undefined,
  
  env: {
    TAURI_ENV: process.env.TAURI_ENV ?? 'false',
  },

  // Modules natifs et lourds à exclure strictement du bundle d'exécution
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
  
  // Ignorer les fichiers .ts (les API routes comme route.ts) en mode Desktop pour permettre l'export statique
  pageExtensions: isDesktop ? ['tsx', 'jsx', 'js'] : ['tsx', 'ts', 'jsx', 'js'],
  
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

  turbopack: {},

  productionBrowserSourceMaps: false,
  
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'onnxruntime-node': 'commonjs onnxruntime-node',
        'chromadb': 'commonjs chromadb'
      });
    }
    return config;
  },
};

export default nextConfig;
