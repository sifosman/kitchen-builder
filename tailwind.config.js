/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        hds: {
          gold: '#FFC400',
          goldHover: '#FFB300',
          black: '#141414',
          sand: '#F6F4F0',
          card: '#FFFFFF',
          muted: '#6B6B6B',
          border: '#E6E2DA',
          wall: '#EFEBE4',
        },
      },
      boxShadow: {
        card: '0 2px 16px rgba(0,0,0,0.06)',
        float: '0 8px 30px rgba(0,0,0,0.12)',
      },
      borderRadius: {
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
}
