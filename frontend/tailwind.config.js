/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fog: "#E6ECEE",
        paper: "#FFFFFF",
        petrol: { DEFAULT: "#10242B", 700: "#1B3640", 500: "#47606A", 300: "#8FA3AB" },
        road: { DEFAULT: "#0B5CAD", dark: "#084783", soft: "#D8E8F7" },
        ok: { DEFAULT: "#0E7C5A", soft: "#D6EFE6" },
        warn: { DEFAULT: "#B86E00", soft: "#FBE9C8" },
        crit: { DEFAULT: "#B3261E", soft: "#F8DAD7" }
      },
      fontFamily: {
        display: ['"Barlow Condensed"', '"Arial Narrow"', "sans-serif"],
        sans: ['"Public Sans"', "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
