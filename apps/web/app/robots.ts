import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/server-api';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/seller', '/account', '/cart', '/checkout', '/login', '/register', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
