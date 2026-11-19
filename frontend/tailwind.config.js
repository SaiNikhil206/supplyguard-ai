/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        'surface-2': v('surface-2'),
        border: v('border'),
        text: v('text'),
        muted: v('text-muted'),
        primary: v('primary'),
        'primary-fg': v('primary-fg'),
        success: v('success'),
        warning: v('warning'),
        danger: v('danger'),
        info: v('info'),
        sev: {
          low: v('sev-low'),
          medium: v('sev-medium'),
          high: v('sev-high'),
          critical: v('sev-critical'),
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'] },
    },
  },
  plugins: [],
};
