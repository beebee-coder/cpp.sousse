// next.config.ts
import type { NextConfig } from 'next';

const isDesktop = process.env.TAURI_ENV === 'true';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  output: isDesktop ? 'export' : undefined,
  
  // Désactivation du cache Webpack pour stabiliser l'environnement Cloud
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.cache = false;
    }
    return config;
  },

  // ✅ ws ajouté pour résoudre TypeError: bufferUtil.mask is not a function
  serverExternalPackages: [
    'onnxruntime-node', 
    'chromadb', 
    'groq-sdk',
    'weaviate-client',
    'sharp',
    'canvas',
    'jsdom',
    'prisma',
    '@prisma/client',
    'ws'
  ],
  
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
  
  typescript: { ignoreBuildErrors: true },
  // ⚠️ eslint: { ignoreDuringBuilds: true }  // SUPPRIMÉ - à placer ailleurs
};

export default nextConfig;