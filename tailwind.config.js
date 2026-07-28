/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.{html,js}"], // This path is now correct relative to the root
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface": "#f8f4ec", "background": "#f8f4ec", "surface-container": "#eeeeea",
        "surface-container-low": "#f3f4f0", "surface-container-high": "#e8e8e4",
        "surface-container-lowest": "#ffffff", "surface-dim": "#d9dad6", "surface-bright": "#f9faf5",
        "on-surface": "#1a1c1a", "on-background": "#1a1c1a", "on-surface-variant": "#414942",
        "primary": "#0a341d", "on-primary": "#ffffff", "primary-container": "#234b32",
        "on-primary-container": "#8fba9a", "primary-fixed": "#c0edcb", "primary-fixed-dim": "#a5d1b0",
        "inverse-primary": "#a5d1b0", "accent-gold": "#C9A86A",
        "secondary": "#605e58", "on-secondary": "#ffffff", "secondary-container": "#e6e2da",
        "on-secondary-container": "#66645e", "charcoal": "#1B1B1B", "muted-gray": "#6B7280",
        "outline": "#727972", "outline-variant": "#c1c8c0",
        "error": "#ba1a1a", "on-error": "#ffffff", "error-container": "#ffdad6",
        "tertiary": "#4b1f27", "on-tertiary": "#ffffff", "tertiary-container": "#65353c",
        "on-tertiary-container": "#e09fa7"
      },
      fontFamily: { 'display-hero': ['Playfair Display', 'serif'], 'headline-lg': ['Playfair Display', 'serif'], 'headline-md': ['Playfair Display', 'serif'], 'body-lg': ['Inter', 'sans-serif'], 'body-md': ['Inter', 'sans-serif'], 'label-sm': ['Inter', 'sans-serif'], 'display': ['Playfair Display', 'serif'], 'body': ['Inter', 'sans-serif'] },
      fontSize: { 'display-hero': ['80px', { lineHeight: '96px', letterSpacing: '0.04em', fontWeight: '700' }], 'display-hero-mobile': ['42px', { lineHeight: '48px', fontWeight: '700' }], 'headline-lg': ['48px', { lineHeight: '56px', fontWeight: '600' }], 'headline-md': ['32px', { lineHeight: '40px', fontWeight: '500' }], 'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }], 'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }], 'label-sm': ['14px', { lineHeight: '20px', letterSpacing: '0.05em', fontWeight: '600' }] },
      borderRadius: { DEFAULT: "1rem", lg: "2rem", xl: "3rem", full: "9999px" },
      spacing: { 'section-gap': '120px', 'margin-desktop': '64px', 'gutter': '24px', 'max-width': '1400px' },
      boxShadow: { 'glass': '0 4px 30px rgba(0, 0, 0, 0.1)' }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}