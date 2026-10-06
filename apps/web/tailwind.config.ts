import type { Config } from 'tailwindcss';

// StyleKart — premium clean: white canvas, near-black ink, hot magenta brand colour.
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Hot magenta — primary actions, links, highlights
        brand: {
          50: '#fff0f6',
          100: '#ffe0ee',
          200: '#ffc2dd',
          300: '#ff93c0',
          400: '#fb5c9d',
          500: '#f02d7d',
          600: '#d81b67',
          700: '#b01354',
          900: '#5e0b2e',
        },
        // Secondary highlight (kept as a softer magenta so every accent stays on-brand)
        accent: {
          300: '#ffb3d1',
          400: '#ff7ab0',
          500: '#f02d7d',
          600: '#d81b67',
        },
        // "Buy now" and other strong neutral actions
        buy: {
          500: '#16161a',
          600: '#000000',
        },
        // Dark neutrals for footer, badges and admin sidebar
        navy: {
          700: '#2a2a31',
          800: '#1d1d22',
          900: '#141418',
          950: '#0b0b0e',
        },
        page: '#f6f6f7',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 16, 20, 0.04), 0 1px 6px rgba(16, 16, 20, 0.05)',
        lift: '0 12px 32px rgba(16, 16, 20, 0.12)',
      },
      container: { center: true, padding: '1rem', screens: { '2xl': '1360px' } },
    },
  },
  plugins: [],
} satisfies Config;
