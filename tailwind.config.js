/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.{html,js}", // Scans all .html and .js files in the root
  ],
  theme: {
    extend: {
      colors: {
        'brand-dark': '#1a202c',
        'brand-gray': '#6b7280',
        'brand-light-gray': '#f7fafc',
        'brand-blue': '#0064D2',
        'brand-yellow': '#ffc107',
      }
    },
  },
  plugins: [],
}