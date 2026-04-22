import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Editorial Intelligence design tokens ──────────────────────
        // P1: Values wrapped in rgb(var(...)) so Tailwind's /opacity modifier
        //     generates valid `rgb(R G B / alpha)` syntax. CSS vars store
        //     channel tuples (no # prefix) — see globals.css :root.
        // Surface scale
        'surface':                  'rgb(var(--color-surface))',
        'surface-container':        'rgb(var(--color-surface-container))',
        'surface-container-high':   'rgb(var(--color-surface-container-high))',
        'surface-bright':           'rgb(var(--color-surface-bright))',
        // Brand
        'primary':                  'rgb(var(--color-primary))',
        'primary-container':        'rgb(var(--color-primary-container))',
        'secondary':                'rgb(var(--color-secondary))',
        'secondary-container':      'rgb(var(--color-secondary-container))',
        'tertiary':                 'rgb(var(--color-tertiary))',
        'tertiary-container':       'rgb(var(--color-tertiary-container))',
        // Text
        'on-surface':               'rgb(var(--color-on-surface))',
        'on-surface-variant':       'rgb(var(--color-on-surface-variant))',
        // Borders
        'outline':                  'rgb(var(--color-outline))',
        'outline-variant':          'rgb(var(--color-outline-variant))',
        // Semantic
        'positive':                 'rgb(var(--color-positive))',
        'negative':                 'rgb(var(--color-negative))',
      },
      fontFamily: {
        // Plus Jakarta Sans — display headings (confirmed from Stitch HTML)
        display: ['var(--font-display)', '"Plus Jakarta Sans"', 'sans-serif'],
        // Manrope — body/labels (confirmed from Stitch HTML)
        sans:    ['var(--font-sans)', 'Manrope', 'sans-serif'],
        // P2: Use CSS variable injected by next/font for zero-FOUT mono
        mono:    ['var(--font-mono)', '"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'xp-fill': 'xp-fill 1s ease-out forwards',
        'bounce-in': 'bounce-in 0.5s cubic-bezier(0.68,-0.55,0.265,1.55)',
      },
      keyframes: {
        'xp-fill': {
          from: { width: '0%' },
          to: { width: 'var(--xp-pct)' },
        },
        'bounce-in': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};

export default config;
