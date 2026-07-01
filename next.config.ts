
import type { NextConfig } from 'next';

const isDesktop = process.env.TAURI_ENV === 'true';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  output: isDesktop ? 'export' : undefined,
  
  // Désactivation du cache Webpack pour stabiliser l'environnement Cloud et éviter les 404 statiques
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.cache = false;
    }
    return config;
  },

  serverExternalPackages: [
    'onnxruntime-node', 
    'chromadb', 
    'groq-sdk',
    'weaviate-client',
    'sharp',
    'canvas',
    'jsdom',
    'prisma',
    '@prisma/client'
  ],
  
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
  
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
