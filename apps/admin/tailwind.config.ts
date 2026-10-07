import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // "Neel & Mitti" palette — indigo (neel) for trust, terracotta (mitti) for action.
        // Primary (links, selection, focus): indigo
        brand: {
          50: '#eef0fa',
          100: '#dde2f5',
          200: '#bcc5ea',
          500: '#4a5cb0',
          600: '#2e3f8f',
          700: '#263578',
          900: '#1a2456',
        },
        // Header / footer: deep indigo
        navy: {
          700: '#2a3770',
          800: '#23305f',
          900: '#1f2a5a',
          950: '#161e45',
        },
        // Highlights on the dark header (deals, badges, search): light terracotta
        accent: {
          300: '#f6c3b0',
          400: '#ef9a7c',
          500: '#e07a5a',
          600: '#c2512f',
        },
        // Buy now / place order: terracotta
        buy: {
          500: '#c2512f',
          600: '#a8432a',
        },
        page: '#f4f5f9',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.08)',
        lift: '0 8px 24px rgba(15, 23, 42, 0.12)',
      },
      container: { center: true, padding: '1rem', screens: { '2xl': '1360px' } },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
    },
  },
  plugins: [],
} satisfies Config;
