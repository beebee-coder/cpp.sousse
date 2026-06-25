
import type { NextConfig } from 'next';

const isDesktop = process.env.TAURI_ENV === 'true';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // En mode Desktop (Tauri), on force l'export statique. 
  // En mode Web, on laisse Next.js gérer le rendu dynamique par défaut pour plus de stabilité en dev.
  output: isDesktop ? 'export' : undefined,
  
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

  // Désactivation des sourcemaps en prod pour alléger les chunks
  productionBrowserSourceMaps: false,
  
  // Optimisation de la compilation pour éviter les erreurs de modules manquants
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
