import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'var(--surface)',
          subtle: 'var(--surface-subtle)',
          hover: 'var(--surface-hover)',
        },
        foreground: {
          DEFAULT: 'var(--foreground)',
          muted: 'var(--foreground-muted)',
          lighter: 'var(--foreground-lighter)',
        },
      },
      borderColor: {
        DEFAULT: 'var(--border)',
        strong: 'var(--border-strong)',
      },
      keyframes: {
        sweep: {
          '0%': { left: '-100%' },
          '20%': { left: '200%' },
          '100%': { left: '200%' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up-out': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-12px)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        sweep: 'sweep 4s infinite linear',
        'slide-down': 'slide-down 0.3s ease-out',
        'slide-up-out': 'slide-up-out 0.3s ease-in forwards',
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
