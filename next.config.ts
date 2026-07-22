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
          'weaviate-client',
          '@grpc/grpc-js',
          'nice-grpc',
          '@neondatabase/serverless',
          '@prisma/adapter-neon',
        ]];
        const tauriExternalFn = (ctx: any, req: string, cb: any) => {
          if (req.startsWith('@tauri-apps/')) {
            return cb(null, 'commonjs ' + req);
          }
          cb();
        };
        config.externals = [
          ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
          tauriExternalFn,
        ];
      }
    }
    return config;
  },

  // ✅ ws ajouté pour résoudre TypeError: bufferUtil.mask is not a function
  serverExternalPackages: [
    'onnxruntime-node', 
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
