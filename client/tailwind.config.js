import defaultTheme from 'tailwindcss/defaultTheme';

/**
 * Design tokens.
 * - navy:   page and surface scale (dark navy)
 * - brand/cyan: interactive accents
 * - series: the two chart categories (validated blue/orange pair, ΔE 26.8 under CVD simulation)
 * - risk:   reserved status colours; always shown with an icon and a text label, never colour alone
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#060b1a',
          900: '#0a1128',
          850: '#0d1733',
          800: '#111d3f',
          700: '#1a2a55',
          600: '#25386b',
        },
        ink: { DEFAULT: '#e8eefc', soft: '#aab6d6', mute: '#8493b8' },
        line: { DEFAULT: 'rgba(148,170,220,0.16)', strong: 'rgba(148,170,220,0.3)' },
        brand: { 300: '#8dbcff', 400: '#5aa2ff', 500: '#3987e5', 600: '#2a6bc4' },
        cyan: { 300: '#67e8f9', 400: '#22d3ee', 500: '#06b6d4' },
        series: {
          legit: { DEFAULT: '#3987e5', text: '#7db4f5' },
          phish: { DEFAULT: '#d95926', text: '#f0936b' },
        },
        risk: {
          low: { DEFAULT: '#0ca30c', text: '#58d058' },
          medium: { DEFAULT: '#fab219', text: '#fab219' },
          high: { DEFAULT: '#d03b3b', text: '#f28b8b' },
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', ...defaultTheme.fontFamily.sans],
        sans: ['"Instrument Sans"', ...defaultTheme.fontFamily.sans],
        mono: ['"JetBrains Mono"', ...defaultTheme.fontFamily.mono],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(148,170,220,0.06) inset, 0 14px 34px -14px rgba(2,6,23,0.7)',
        glow: '0 0 0 1px rgba(34,211,238,0.35), 0 10px 36px -10px rgba(34,211,238,0.35)',
      },
      keyframes: {
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: { 'toast-in': 'toast-in 160ms ease-out' },
    },
  },
  plugins: [],
};
