/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.{html,js}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#4f46e5',      // A nice indigo
        'secondary': '#64748b',    // Slate gray
        'accent': '#f59e0b',       // Amber/Yellow
        'dark': '#111827',         // Dark gray for text
        'light': '#f9fafb',        // Very light gray for backgrounds
      }
    },
  },
  plugins: [],
}