/** Tailwind v3 preset (used by NativeWind on mobile). Generated from tokens.js values. */
const tokens = require('./tokens.json');

module.exports = {
  theme: {
    extend: {
      colors: tokens.colors,
      borderRadius: tokens.radius,
      fontFamily: tokens.fontFamily,
      boxShadow: tokens.shadow,
      maxWidth: { container: tokens.layout.container },
    },
  },
};
