/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Ink & Tone palette — keep in sync with constants/theme.ts
      colors: {
        gutter: '#0E0E10',
        panel: '#17171A',
        'panel-raised': '#242429',
        edge: '#33333A',
        paper: '#F2EFE6',
        tone: '#8C8C96',
        'tone-dim': '#5C5C66',
        accent: '#FF4D2E',
        'accent-pressed': '#D93C21',
        gold: '#F2B53B',
        danger: '#FF5A5A',
      },
    },
  },
  plugins: [],
}
