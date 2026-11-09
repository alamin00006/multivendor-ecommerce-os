import type { NextConfig } from 'next';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  transpilePackages: ['@marketbd/shared', '@marketbd/api-client'],
  // The browser talks to the API through the same origin so the httpOnly refresh cookie just works.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API_INTERNAL_URL}/api/v1/:path*` }];
  },
  images: {
    // Every next/image request goes through the API's resize endpoint (GET /images/resize).
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
