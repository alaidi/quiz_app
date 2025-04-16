/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./build/*.html", "./build/script/*.js"],
  theme: {
    extend: {
      scale: {
        '102': '1.02',
      },
      animation: {
        'bounce-once': 'bounce 1s ease-in-out 1',
        'float': 'float 6s ease-in-out infinite',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'sans-serif'],
      },
      colors: {
        slate: {
          850: '#1e293b',
        },
      },
      boxShadow: {
        'glow': '0 0 15px -3px rgba(59, 130, 246, 0.5)',
      },
    },
    screens: {
      'xs': '320px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
    },
  },
  plugins: [],
}
