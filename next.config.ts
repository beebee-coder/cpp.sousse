
import type { NextConfig } from 'next';

const isDesktop = process.env.TAURI_ENV === 'true';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Modules natifs lourds à exclure strictement du bundle d'exécution
  // Cela empêche Vercel de tenter de zipper ces packages (ex: Transformers = 350MB)
  serverExternalPackages: [
    'onnxruntime-node', 
    '@huggingface/transformers', 
    'chromadb', 
    'groq-sdk',
    'weaviate-client'
  ],

  // Mode export pour Tauri, standard pour Vercel
  output: isDesktop ? 'export' : undefined,
  
  images: {
    unoptimized: isDesktop ? true : false,
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
};

export default nextConfig;
