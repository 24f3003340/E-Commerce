import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/account', '/cart', '/checkout', '/login', '/register', '/forgot-password', '/reset-password', '/wishlist'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
