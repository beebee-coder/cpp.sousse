
import type { NextConfig } from 'next';

const isDesktop = process.env.TAURI_ENV === 'true';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Modules natifs à exclure strictement du bundle client
  serverExternalPackages: ['onnxruntime-node', '@huggingface/transformers', 'chromadb', 'groq-sdk'],

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
