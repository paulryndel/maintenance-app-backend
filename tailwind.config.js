/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.{html,js}","./api/**/*.js"],
  theme: {
    extend: {
      colors: {
        primary: "#4f46e5",
        secondary: "#64748b",
        accent: "#f59e0b",
        dark: "#111827",
        light: "#f9fafb",
        "brand-gray": "#64748b",
        "brand-dark": "#111827"
      }
    }
  },
  plugins: []
}