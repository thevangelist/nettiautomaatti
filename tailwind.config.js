/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./content.js'],
  // Prefix all classes to avoid collisions with nettiauto.fi styles
  prefix: 'na-',
  theme: {
    extend: {
      colors: {
        brand: '#cc3300',
        surface: '#f3f0ec',
        border: '#ddd8d2',
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        xs: ['11px', '16px'],
        sm: ['12.5px', '18px'],
        base: ['13px', '20px'],
        md: ['14px', '20px'],
        lg: ['15px', '22px'],
      },
      borderRadius: {
        card: '8px',
        inner: '6px',
      },
      boxShadow: {
        panel: '0 2px 20px rgba(0,0,0,0.13)',
      },
    },
  },
  plugins: [],
};
