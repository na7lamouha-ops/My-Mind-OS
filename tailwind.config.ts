import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark-first tokens for My Mind OS
        bg: '#0b0f17',
        surface: '#121826',
        border: '#1f2937',
        muted: '#9ca3af',
        text: '#e5e7eb',
        accent: '#6366f1',
        'accent-soft': '#4338ca',
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
