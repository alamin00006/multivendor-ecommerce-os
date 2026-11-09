/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,tsx}', './src/**/*.{js,ts,tsx}'],
  presets: [require('nativewind/preset'), require('../../packages/config/tokens/tailwind-preset.cjs')],
  plugins: [],
};
