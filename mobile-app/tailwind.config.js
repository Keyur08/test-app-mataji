/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./index.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  // Use class-based dark mode so NativeWind allows manually setting the
  // color scheme on web (otherwise it throws:
  // "Cannot manually set color scheme, as dark mode is type 'media'…").
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#B8336A",
        saffron: "#F4A261",
        cream: "#FFF8F0",
      },
    },
  },
  plugins: [],
};

