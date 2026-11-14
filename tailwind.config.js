/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette — can be customised later
        primary: {
          50:  '#f0f4ff',
          100: '#e0eaff',
          500: '#3b6bdf',
          600: '#2d55c7',
          700: '#2244aa',
          900: '#152a6b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
