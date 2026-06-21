
import type { NextConfig } from 'next';

// Mode d'exécution hybride : TAURI_ENV = true génère un export statique adapté pour le bureau (sans serveur Node)
const isDesktop = process.env.TAURI_ENV === 'true';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Modules natifs Node.js à ne pas bundler (déclarés comme externes au serveur)
  serverExternalPackages: ['onnxruntime-node', '@huggingface/transformers', 'chromadb', 'groq-sdk'],

  // Mode export statique pour Tauri, standard pour Vercel
  output: isDesktop ? 'export' : undefined,
  
  images: {
    unoptimized: isDesktop ? true : false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  
  typescript: {
    ignoreBuildErrors: true,
  },
  
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  reactStrictMode: true,
};

export default nextConfig;
