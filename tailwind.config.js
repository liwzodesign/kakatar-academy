/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF4EC', 100: '#FFE4CF', 200: '#FFC79E', 300: '#FDA466', 400: '#F7812F',
          500: '#EE6A12', 600: '#E85D04', 700: '#BB4A05', 800: '#943B0B', 900: '#78320C',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
