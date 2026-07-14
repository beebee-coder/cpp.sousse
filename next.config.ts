// next.config.ts
import type { NextConfig } from 'next';

const isDesktop = process.env.TAURI_ENV === 'true';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  output: isDesktop ? 'export' : undefined,
  
  // Désactivation du cache Webpack pour stabiliser l'environnement Cloud
  webpack: (config: any, context: any) => {
    const { isServer, isTurbopack } = context;
    if (!isTurbopack) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        http2: false,
        dns: false,
      };
      if (!isServer) {
        config.externals = [...(config.externals || []), ...[
          'chromadb',
          'weaviate-client',
          '@grpc/grpc-js',
          'nice-grpc',
          '@neondatabase/serverless',
          '@prisma/adapter-neon',
        ]];
      }
    }
    return config;
  },

  // ✅ ws ajouté pour résoudre TypeError: bufferUtil.mask is not a function
  serverExternalPackages: [
    'onnxruntime-node', 
    'chromadb', 
    'groq-sdk',
    'weaviate-client',
    '@grpc/grpc-js',
    'nice-grpc',
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
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;