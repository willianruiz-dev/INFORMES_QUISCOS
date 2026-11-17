/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        ink: '#192840',
        muted: '#758298',
        brand: '#2768df',
        canvas: '#f5f7fb'
      },
      fontFamily: { sans: ['DM Sans', 'sans-serif'] }
    }
  },
  plugins: []
};
