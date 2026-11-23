// Verifies WCAG AA (4.5:1) for the token pairs in src/index.css, light and dark.
// Run: node scripts/check-contrast.mjs
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const block = (sel) => {
  const m = css.match(new RegExp(`${sel}\\s*\\{([^}]*)\\}`));
  return Object.fromEntries([...m[1].matchAll(/--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%;/g)].map((x) => [x[1], [+x[2], +x[3], +x[4]]]));
};
const hsl = ([h, s, l]) => {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))));
};
const lum = (rgb) => {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const mix = (fg, bg, a) => fg.map((c, i) => c * a + bg[i] * (1 - a));
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

let failed = 0;
for (const [name, sel] of [['light', ':root'], ['dark', '\\.dark']]) {
  const t = block(sel);
  const c = (k) => hsl(t[k]);
  const pairs = [
    ['foreground', 'background'],
    ['foreground', 'card'],
    ['card-foreground', 'card'],
    ['popover-foreground', 'popover'],
    ['primary-foreground', 'primary'],
    ['secondary-foreground', 'secondary'],
    ['accent-foreground', 'accent'],
    ['destructive-foreground', 'destructive'],
    ['muted-text', 'background'],
    ['muted-text', 'card'],
    ['muted-text', 'surface-2'],
    ['muted-text', 'secondary'],
    ['sidebar-fg', 'sidebar'],
    ['sidebar-muted', 'sidebar'],
    ['primary', 'card'],
    ['primary', 'background'],
  ];
  const rows = pairs.map(([f, b]) => [`${f} on ${b}`, ratio(c(f), c(b))]);
  // Semantic text on its own 10% tint over card, and on plain card/background.
  for (const k of ['success', 'warning', 'danger', 'info', 'sev-low', 'sev-medium', 'sev-high', 'sev-critical']) {
    rows.push([`${k} on card`, ratio(c(k), c('card'))]);
    rows.push([`${k} on background`, ratio(c(k), c('background'))]);
    rows.push([`${k} on ${k}/10 tint`, ratio(c(k), mix(c(k), c('card'), 0.1))]);
  }
  rows.push(['accent-foreground on sidebar/card (active nav)', ratio(c('accent-foreground'), c('accent'))]);
  rows.push(['sidebar-fg on accent', ratio(c('sidebar-fg'), c('background'))]);
  for (const [label, r] of rows) {
    const ok = r >= 4.5;
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(5)} ${r.toFixed(2).padStart(6)}  ${label}`);
  }
}
process.exit(failed ? 1 : 0);
