import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // DukaanX palette (from the logo) — deep teal for trust, amber for action.
        // Primary (links, selection, focus): teal
        brand: {
          50: '#e9f5f2',
          100: '#d2ebe6',
          200: '#a6d6cc',
          500: '#1a9583',
          600: '#12796b',
          700: '#0e6459',
          900: '#0b3b36',
        },
        // Header / footer: deep teal
        navy: {
          700: '#11544c',
          800: '#0e4841',
          900: '#0b3b36',
          950: '#072925',
        },
        // Highlights on the dark header (deals, badges, search): amber
        accent: {
          300: '#fcd38a',
          400: '#f8b739',
          500: '#f29e0c',
          600: '#d4840a',
        },
        // Buy now / place order: amber with deep-teal text
        buy: {
          500: '#f29e0c',
          600: '#e08e06',
        },
        page: '#f3f6f5',
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
