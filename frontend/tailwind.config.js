/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f0f0f",
        card: "#161616",
        "card-light": "#222222",
        brand: {
          50: "#fef8e6",
          100: "#fdf1c7",
          200: "#fbe290",
          300: "#f9cd52",
          400: "#f7b723",
          500: "#d97706", // Brand Amber
          600: "#b45309",
          700: "#78350f",
          800: "#451a03",
          900: "#1c0b02",
        },
        status: {
          green: "#10b981",   // healthy / active
          orange: "#f59e0b",  // warning / due soon
          red: "#ef4444",     // critical / conflict
          blue: "#3b82f6"     // in progress
        }
      },
      fontFamily: {
        sans: ["Outfit", "Inter", "system-ui", "sans-serif"],
      }
    },
  },
  plugins: [],
}
