import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#007F66',
          dark: '#003329',
          neutral: '#F9FFFE',
          text: '#26282A',
          accent: '#F7E7CE',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'serif'],
        sans: ['Inter', 'sans-serif'],
        motto: ['"Edwardian Script ITC"', '"Pinyon Script"', 'cursive'],
      },
    },
  },
  plugins: [],
};

export default config;
