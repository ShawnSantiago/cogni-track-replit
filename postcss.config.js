const plugins = {}

try {
  require.resolve('tailwindcss')
  plugins.tailwindcss = {}
} catch (error) {
  console.warn('Tailwind CSS not installed; skipping tailwindcss PostCSS plugin for this build.')
}

plugins.autoprefixer = {}

module.exports = { plugins }
