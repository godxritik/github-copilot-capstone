/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: '#1E3B2F',
        sage: '#7F8C6A',
        sand: '#C8B48A',
        cream: '#F5F0E6',
      },
    },
  },
  plugins: [],
};
