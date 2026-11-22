/** @type {import('tailwindcss').Config} */
const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
/** primary-* / accent-* read CSS variables so the brand colours set in Admin → Settings apply at runtime. */
const brand = (name) => Object.fromEntries(shades.map((s) => [s, `rgb(var(--color-${name}-${s}) / <alpha-value>)`]));

module.exports = {
  content: ['./app/**/*.{js,ts,tsx}', './src/**/*.{js,ts,tsx}'],
  presets: [require('nativewind/preset'), require('../../packages/config/tokens/tailwind-preset.cjs')],
  theme: {
    extend: {
      colors: { primary: brand('primary'), accent: brand('accent') },
    },
  },
  plugins: [],
};
