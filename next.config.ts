
import type { NextConfig } from 'next';

// Mode d'exécution hybride : TAURI_ENV = true génère un export statique adapté pour le bureau (sans serveur Node)
const isDesktop = process.env.TAURI_ENV === 'true';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Modules natifs Node.js à ne pas bundler (ONNX Runtime, HuggingFace Transformers)
  serverExternalPackages: ['onnxruntime-node', '@huggingface/transformers', 'chromadb'],

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

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.externals = {
        ...config.externals,
        'chromadb': '{}',
        '@huggingface/transformers': '{}',
        'onnxruntime-node': '{}',
      };
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        process: false,
        'node:process': false,
        crypto: false,
        os: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
      };
    }
    return config;
  },
};

export default nextConfig;
