import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark-first, contrast-checked tokens for My Mind OS.
        bg: '#0a0c11',
        surface: '#13161f',
        elevated: '#1a1e2a',
        border: '#262c3a',
        'border-strong': '#343c4f',
        muted: '#9aa3b8',
        text: '#eceef4',
        // Indigo-600 as button/fill (AA with white ~5.9:1)…
        accent: '#4f46e5',
        'accent-soft': '#4338ca',
        // …and a lighter indigo for text/links on dark (AA on bg).
        link: '#a5b4fc',
        success: '#34d399',
        warning: '#fbbf24',
        danger: '#f87171',
      },
      fontFamily: {
        sans: ['Cairo', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.9rem',
        '2xl': '1.15rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.35), 0 8px 24px -12px rgba(0,0,0,0.5)',
        pop: '0 12px 40px -12px rgba(0,0,0,0.6)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.2s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
