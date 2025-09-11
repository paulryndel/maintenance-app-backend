/** @type {import('tailwindcss').Config} */
module.exports = {
  // Change this content path
  content: [
    "./public/**/*.{html,js}", // Scan inside the public folder
    "./api/**/*.js"
  ],
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