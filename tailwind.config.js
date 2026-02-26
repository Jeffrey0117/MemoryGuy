/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'mg-primary': '#3b82f6',
        'mg-success': '#22c55e',
        'mg-warning': '#f59e0b',
        'mg-danger': '#ef4444',
        'mg-bg': '#0f172a',
        'mg-surface': '#1e293b',
        'mg-border': '#334155',
        'mg-text': '#e2e8f0',
        'mg-muted': '#94a3b8',
      },
    },
  },
  plugins: [],
};
