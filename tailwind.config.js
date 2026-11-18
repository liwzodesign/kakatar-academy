/** @type {import('tailwindcss').Config} */
// Système de design Kakatar Academy — couleurs issues du logo officiel.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Bleu marine du logotype (#263682) — couleur principale (actions, liens, navigation)
        primary: {
          50: '#eef1fb',
          100: '#dde3f6',
          200: '#bcc7ec',
          300: '#90a2dd',
          400: '#6178c9',
          500: '#4058b5',
          600: '#2f449d',
          700: '#263682',
          800: '#1f2b68',
          900: '#192253',
          950: '#0f1533',
        },
        // Vert du blason (#4BB698) — succès, progression, accents positifs
        secondary: {
          50: '#edf9f5',
          100: '#d4f1e7',
          200: '#ace3d1',
          300: '#7ccfb5',
          400: '#5cc2a5',
          500: '#4bb698',
          600: '#37997e',
          700: '#2d7b66',
          800: '#276353',
          900: '#225245',
        },
        // Jaune soleil (#F8B92C) — mise en avant, notes, badges
        sun: { 50: '#fef8e7', 100: '#fdeec3', 200: '#fcdc8a', 400: '#f9c64f', 500: '#f8b92c', 600: '#dc9a10', 700: '#b07809', 800: '#8a5d0b' },
        // Bleu ciel (#4F95D1) et rose (#DD7EAE) — illustrations et catégories
        sky: { 100: '#e1eef9', 500: '#4f95d1', 600: '#3a7cb8' },
        rose: { 100: '#f9e6f0', 500: '#dd7eae', 600: '#c95c93' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 21, 51, 0.04), 0 4px 16px rgba(15, 21, 51, 0.06)',
        lift: '0 8px 30px rgba(38, 54, 130, 0.14)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #263682 0%, #2f449d 45%, #37997e 100%)',
      },
    },
  },
  plugins: [],
};
