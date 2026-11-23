import animate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
const h = (name) => `hsl(var(--${name}) / <alpha-value>)`;
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      colors: {
        // shadcn tokens
        border: h('border'),
        input: h('input'),
        ring: h('ring'),
        background: h('background'),
        foreground: h('foreground'),
        primary: { DEFAULT: h('primary'), foreground: h('primary-foreground') },
        secondary: { DEFAULT: h('secondary'), foreground: h('secondary-foreground') },
        destructive: { DEFAULT: h('destructive'), foreground: h('destructive-foreground') },
        // NOTE: `muted` is the muted TEXT colour (legacy screens use text-muted); backgrounds use surface-2.
        muted: { DEFAULT: h('muted-text'), foreground: h('muted-text') },
        accent: { DEFAULT: h('accent'), foreground: h('accent-foreground') },
        popover: { DEFAULT: h('popover'), foreground: h('popover-foreground') },
        card: { DEFAULT: h('card'), foreground: h('card-foreground') },
        // legacy aliases kept so existing screens keep working
        bg: h('background'),
        surface: h('card'),
        'surface-2': h('surface-2'),
        text: h('foreground'),
        sidebar: { DEFAULT: h('sidebar'), fg: h('sidebar-fg'), muted: h('sidebar-muted') },
        'primary-fg': h('primary-foreground'),
        success: h('success'),
        warning: h('warning'),
        danger: h('danger'),
        info: h('info'),
        sev: {
          low: h('sev-low'),
          medium: h('sev-medium'),
          high: h('sev-high'),
          critical: h('sev-critical'),
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      // v2: cards carry no shadow. `soft` is kept as a no-op alias; `lift` is a popover-grade shadow-sm.
      boxShadow: {
        soft: 'none',
        lift: '0 1px 2px 0 rgb(15 23 42 / 0.06), 0 1px 3px 0 rgb(15 23 42 / 0.08)',
      },
    },
  },
  plugins: [animate],
};
