/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        mlbb: {
          bg: '#0a0e17',
          card: '#111827',
          cardHover: '#1f2937',
          border: '#1e293b',
          gold: '#f59e0b',
          goldHover: '#d97706',
          accent: '#3b82f6',
          purple: '#8b5cf6',
          danger: '#ef4444',
          success: '#10b981',
          textMuted: '#94a3b8'
        }
      },
      boxShadow: {
        'glow-gold': '0 2px 10px rgba(245, 158, 11, 0.25)',
        'glow-blue': '0 2px 10px rgba(59, 130, 246, 0.25)',
        'glow-emerald': '0 2px 10px rgba(16, 185, 129, 0.25)',
      }
    },
  },
  plugins: [],
}
