import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  isProduction,
  port: Number(process.env.PORT ?? 4000),
  // RENDER_EXTERNAL_URL is set automatically on Render
  publicApiUrl: process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:4000',
  /** Customer website URL, used in emails (password reset, order links). */
  storefrontUrl: (process.env.STOREFRONT_URL || 'http://localhost:3000').replace(/\/$/, ''),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /**
   * The mock payment gateway is never available in production unless explicitly enabled
   * (useful for a public demo deployment before Razorpay keys are added).
   */
  allowMockPayments: !isProduction || process.env.ALLOW_MOCK_PAYMENTS === 'true',
  redisUrl: process.env.REDIS_URL || undefined,
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', isProduction ? undefined : 'dev-access-secret'),
    adminAccessSecret: required(
      'JWT_ADMIN_ACCESS_SECRET',
      isProduction ? undefined : 'dev-admin-access-secret',
    ),
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    get enabled() {
      return Boolean(this.keyId && this.keySecret);
    },
  },
  shippingWebhookToken: process.env.SHIPPING_WEBHOOK_TOKEN || '',
  /**
   * S3-compatible object storage for uploaded images (Cloudflare R2, AWS S3, DigitalOcean Spaces…).
   * When not configured, uploads are written to the local disk (fine for development only).
   */
  storage: {
    endpoint: process.env.S3_ENDPOINT || '',
    region: process.env.S3_REGION || 'auto',
    bucket: process.env.S3_BUCKET || '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    /** Public base URL of the bucket / CDN, e.g. https://images.yourstore.com */
    publicUrl: (process.env.S3_PUBLIC_URL || '').replace(/\/$/, ''),
    get enabled() {
      return Boolean(this.bucket && this.accessKeyId && this.secretAccessKey && this.publicUrl);
    },
  },
  email: {
    resendApiKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM ?? 'Store <orders@example.com>',
  },
  /** Unpaid online orders are cancelled and their stock released after this many minutes. */
  pendingPaymentTimeoutMinutes: Number(process.env.PENDING_PAYMENT_TIMEOUT_MINUTES ?? 30),
};
