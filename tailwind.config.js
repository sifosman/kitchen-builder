/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        hds: {
          gold: '#FFC400',
          goldHover: '#FFB300',
          black: '#111111',
          sand: '#E9E4DC',
          card: '#FFFFFF',
          muted: '#5A5A5A',
          border: '#D6D0C6',
          wall: '#E3DDD3',
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
