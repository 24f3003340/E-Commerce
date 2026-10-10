// The API the app talks to. Set EXPO_PUBLIC_API_URL in .env (or in eas.json per build profile).
// Android emulator reaches the host machine at 10.0.2.2, not localhost.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

// Customer website, used for policy pages and password reset
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export const STORE_NAME = process.env.EXPO_PUBLIC_STORE_NAME ?? 'DukaanX';
