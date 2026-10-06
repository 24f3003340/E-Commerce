/**
 * Public website URL (no trailing slash) — used for canonical links, sitemap and structured data.
 * Set NEXT_PUBLIC_SITE_URL to your domain; on Vercel it falls back to the project's production URL.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')
).replace(/\/$/, '');
