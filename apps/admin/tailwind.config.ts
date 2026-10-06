import type { Config } from 'tailwindcss';

// StyleKart Gen-Z: electric violet + neon lime + hot pink, chunky type,
// thick black outlines and hard "sticker" shadows.
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Electric violet — primary brand
        brand: {
          50: '#f4f0ff',
          100: '#e9e1ff',
          200: '#d4c5ff',
          300: '#b59bff',
          400: '#9468ff',
          500: '#7c3aed',
          600: '#6d28d9',
          700: '#5b21b6',
          900: '#2e1065',
        },
        // Neon lime — highlights & main CTA
        accent: {
          100: '#f3ffc9',
          300: '#e2ff7a',
          400: '#d4ff3f',
          500: '#c2f01c',
          600: '#9ccc00',
        },
        // Hot pink — discounts, hearts, "steal" stickers
        hot: {
          100: '#ffe1f0',
          400: '#ff5cad',
          500: '#ff2e93',
          600: '#e0157a',
        },
        sky: {
          100: '#dff3ff',
          400: '#4cc3ff',
        },
        buy: {
          500: '#111111',
          600: '#000000',
        },
        navy: {
          700: '#2b2440',
          800: '#1c1730',
          900: '#130f22',
          950: '#0b0815',
        },
        page: '#fbf8ff',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,16,20,0.04), 0 1px 6px rgba(16,16,20,0.06)',
        brutal: '4px 4px 0 0 #111',
        'brutal-sm': '2px 2px 0 0 #111',
        'brutal-lg': '6px 6px 0 0 #111',
        lift: '0 12px 32px rgba(16,16,20,0.12)',
      },
      container: { center: true, padding: '1rem', screens: { '2xl': '1360px' } },
      keyframes: {
        marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        wiggle: { '0%,100%': { transform: 'rotate(-3deg)' }, '50%': { transform: 'rotate(3deg)' } },
      },
      animation: {
        marquee: 'marquee 28s linear infinite',
        wiggle: 'wiggle 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
