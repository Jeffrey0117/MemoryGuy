/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'mg-primary': 'var(--mg-primary)',
        'mg-success': 'var(--mg-success)',
        'mg-warning': 'var(--mg-warning)',
        'mg-danger': 'var(--mg-danger)',
        'mg-bg': 'var(--mg-bg)',
        'mg-surface': 'var(--mg-surface)',
        'mg-border': 'var(--mg-border)',
        'mg-text': 'var(--mg-text)',
        'mg-muted': 'var(--mg-muted)',
      },
    },
  },
  plugins: [],
};
