import type { Config } from 'tailwindcss';

// StyleKart brand: warm cream canvas, coral as the hero colour, ink for text,
// sage and butter as friendly supporting accents.
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-body)', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fff4ef',
          100: '#ffe4d9',
          200: '#ffc8b3',
          300: '#fba487',
          400: '#f4826a',
          500: '#ea6547',
          600: '#d24d31',
          700: '#a93a23',
          900: '#5c1f12',
        },
        ink: {
          50: '#f7f5f2',
          100: '#ece8e2',
          200: '#ddd7ce',
          300: '#bdb5aa',
          500: '#766d62',
          700: '#3b352e',
          800: '#2a251f',
          900: '#1f1b16',
          950: '#14110d',
        },
        sage: {
          50: '#f1f6f1',
          100: '#e1ece2',
          300: '#a9c4ac',
          500: '#6b8f71',
          700: '#46664c',
        },
        butter: {
          50: '#fffaeb',
          100: '#fdf1c9',
          300: '#f7d877',
          400: '#f2c94c',
        },
        page: '#faf6f0',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(31, 27, 22, 0.04), 0 2px 8px rgba(31, 27, 22, 0.05)',
        lift: '0 12px 32px rgba(31, 27, 22, 0.12)',
      },
      container: { center: true, padding: '1rem', screens: { '2xl': '1320px' } },
      keyframes: {
        marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
