
import type { NextConfig } from 'next';

const isDesktop = process.env.TAURI_ENV === 'true';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Mode standalone pour réduire drastiquement la taille du bundle sur Vercel (limite 250Mo)
  output: isDesktop ? 'export' : 'standalone',
  
  // Modules natifs et lourds à exclure strictement du bundle d'exécution Serverless
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
