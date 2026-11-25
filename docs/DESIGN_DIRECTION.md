# SupplyGuard AI - Design direction (R-10)

Goal: the UI must look like a premium, modern AI SaaS (think Linear / Vercel / Stripe dashboards), not a default admin template. Bold but calm, data-rich, delightful.

## Visual language
- **Canvas:** app background is not flat - subtle radial gradient glow at the top (`bg-[radial-gradient(ellipse_at_top,theme(colors.primary/0.12),transparent_60%)]`) over `bg-background`; dark mode uses deep slate/indigo (near #0B1020), not grey.
- **Cards:** `rounded-2xl border border-border/60 bg-card/80 backdrop-blur shadow-sm hover:shadow-md transition` ; important cards get a 1px gradient ring (wrapper `p-px rounded-2xl bg-gradient-to-br from-primary/40 via-border to-transparent`).
- **Page header (every screen):** eyebrow (small uppercase tracking-wider text-primary), large title `text-3xl font-semibold tracking-tight`, one-line description `text-muted-foreground`, actions on the right; optional KPI strip under it. Same recipe on every page.
- **Color as meaning:** severity uses consistent hues (low=emerald, medium=amber, high=orange, critical=rose) as soft tinted chips (`bg-<hue>-500/10 text-<hue>-600 ring-1 ring-<hue>-500/20`, dark: `text-<hue>-400`) plus an icon; never color alone.
- **KPI tiles:** icon in a tinted rounded-xl square, big tabular number (`text-3xl font-semibold tabular-nums`), delta chip (up/down arrow, green/red tint), mini sparkline (Recharts, no axes, gradient fill).
- **Charts:** area charts with vertical gradient fills, rounded bars, soft grid (`stroke-border/50`), custom tooltip card (same card recipe), legend as chips. Use CSS-variable colors.
- **Tables:** sticky header, `text-xs uppercase tracking-wide text-muted-foreground` headers, roomy rows `h-14`, hover `bg-muted/50`, first column with avatar/monogram + two-line label, row actions on hover, zebra off.
- **Empty / loading:** shimmering skeletons matching the final layout; empty states with a large tinted lucide icon in a circle, title, hint and primary action.
- **Motion:** 150-250 ms ease-out; fade/slide-up on page enter, number count-up on KPIs, pulse dot for "Live"; respect `prefers-reduced-motion`.
- **Typography:** Inter, `tabular-nums` for numbers, max 3 text sizes per card.
- **Spacing:** page padding `p-6 lg:p-8`, section gap `gap-6`, card padding `p-5`.
- **AI content:** AI panels get a subtle violet accent (sparkles icon, "AI" chip) so AI output is always recognisable; facts/estimates/assumptions/missing data stay clearly labelled (AC-03).

## UX rules
- Every screen answers "what needs my attention?" first (top summary), then detail.
- Primary action per screen is obvious (one filled button).
- Destructive / approval actions use a confirm Dialog with summary.
- Toasts for every mutation result; inline errors with retry.
- Keyboard: Ctrl/Cmd+K palette, focus rings visible, tables navigable.
- Responsive down to 1280 px perfectly, usable on mobile.
