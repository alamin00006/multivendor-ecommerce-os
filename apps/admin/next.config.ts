import type { NextConfig } from 'next';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  transpilePackages: ['@marketbd/shared', '@marketbd/api-client', '@marketbd/ui'],
  // Same-origin API so the httpOnly refresh cookie works for the admin app too.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API_INTERNAL_URL}/api/v1/:path*` }];
  },
  images: {
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
  },
  // The admin panel must never be indexed.
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
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
