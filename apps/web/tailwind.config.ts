import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Primary (links, selection, focus)
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        // Header / footer
        navy: {
          700: '#16325c',
          800: '#0f2747',
          900: '#0a1c36',
          950: '#06132a',
        },
        // Call to action
        accent: {
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        buy: {
          500: '#f97316',
          600: '#ea580c',
        },
        page: '#f1f3f6',
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
