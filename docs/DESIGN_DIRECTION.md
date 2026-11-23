# SupplyGuard AI - Design System v2 (R-10, binding)

Source: `ui-ux-pro-max` design system (`design-system/supplyguard-ai/MASTER.md`, style **Minimalism & Swiss Style**, B2B SaaS dashboard, variance 3 / motion 3 / density 7) + the owner's brief. **This replaces v1** - remove all v1 gradient glows, glassmorphism (`backdrop-blur`, translucent cards), gradient rings, gradient buttons and violet "AI" gradients.

Inspiration: Linear, Vercel, Stripe Dashboard, Notion. Premium **light mode by default** (dark mode supported, not promoted). It must look like a shipped commercial product, not a template.

## 1. Tokens (shadcn CSS variables, HSL in `src/index.css`)
| Token | Light | Notes |
|---|---|---|
| `--background` | `#F8FAFC` (slate-50) | app canvas, flat - no gradients |
| `--card` / `--popover` | `#FFFFFF` | surfaces |
| `--foreground` | `#0F172A` (slate-900) | headings; body text `#334155` (slate-700) |
| `--muted` | `#F1F5F9` | subtle fills, table header, hover |
| `--muted-foreground` | `#64748B` (slate-500) -> use `#475569` for body-size text (AA) |
| `--border` / `--input` | `#E2E8F0` (slate-200) | 1px hairlines everywhere |
| `--primary` | `#2563EB` (blue-600) | the ONLY brand accent; hover `#1D4ED8` |
| `--primary-foreground` | `#FFFFFF` | |
| `--ring` | `#2563EB` at 40% | 2px focus ring + 2px offset |
| `--destructive` | `#DC2626` | |
| status success / warning / danger / info | `#16A34A` / `#D97706` / `#DC2626` / `#2563EB` | |
| severity low / medium / high / critical | `#16A34A` / `#D97706` / `#EA580C` / `#DC2626` | |
| `--radius` | `0.5rem` (cards `rounded-lg`, inputs/buttons `rounded-md`, chips `rounded-full`) | |
Dark mode: slate-950 canvas `#020617`, cards `#0F172A`, borders `#1E293B`, primary `#3B82F6`; verify 4.5:1.

**Shadows:** none on cards by default (border only). `shadow-sm` only on popovers, dropdowns, dialogs, sticky bars. No coloured or large shadows.

## 2. Typography
- **Inter** (variable, `font-feature-settings: "cv11","ss01"`; fallback system-ui). Load once via Google Fonts with `display=swap`.
- Scale: page title `text-2xl font-semibold tracking-tight` (24px) - section title `text-sm font-semibold` - body `text-sm` (14px, line-height 1.5) - meta `text-xs text-muted-foreground` - KPI numbers `text-2xl font-semibold tabular-nums`. Never below 12px. Max 3 sizes per card.
- Numbers, money, ids: `tabular-nums`; ids/correlation ids `font-mono text-xs`.

## 3. Layout & spacing (4px grid, density 7)
- Shell: **sidebar 240px**, white, right border, collapsible to 56px icons; **header 56px**, white, bottom border, containing breadcrumb (real page names, e.g. "Risk / RC-000045"), Ctrl/Cmd+K search, synthetic-data badge, user menu.
- Content: `max-w-[1440px] mx-auto px-6 py-6`, section gap `space-y-6`, grid gaps `gap-4`, card padding `p-5` (dense tables `p-0` with cell `px-4 py-3`).
- Page header pattern (every page, identical): title + one-line description left, actions right, optional tabs/filters row below separated by spacing (no hero banners, no greetings bigger than meta text).
- Responsive: test 375 / 768 / 1024 / 1440. Sidebar becomes a Sheet below `lg`. Tables scroll inside their card; page never scrolls horizontally.

## 4. Components (shadcn, one look everywhere)
- **Card:** `bg-card border rounded-lg` no shadow; header row `px-5 py-4 border-b` when it has a title.
- **Buttons:** primary solid blue; secondary = white + border; ghost for toolbar; destructive red. Height 36px (`h-9`), icon 16px. One primary per view.
- **Badges/chips:** soft tint + text + optional 6px dot: `bg-<c>-50 text-<c>-700 ring-1 ring-inset ring-<c>-600/20` (dark: `bg-<c>-500/10 text-<c>-400`). Severity and status always have text (never colour alone).
- **KPI stat:** label `text-xs font-medium text-muted-foreground uppercase tracking-wide`, value, delta as small text with arrow (green/red), optional tiny line sparkline (1.5px stroke, no fill or 8% fill). No tinted icon squares.
- **Tables (DataTable feel):** header `bg-muted/50 text-xs font-medium text-muted-foreground`, rows `h-12` hairline separators, hover `bg-muted/40`, right-aligned numbers, sortable headers with icons, row click affordance, sticky header, footer pagination "1-10 of 52".
- **Filters:** toolbar of compact controls (search input with icon, select/segmented, "Clear"), active filters as removable chips.
- **Forms:** label above, helper below, inline errors, `h-9` inputs; save actions right-aligned; dirty sticky footer for settings.
- **Dialogs/Sheets:** white, `shadow-lg` allowed, title + description + footer actions; confirms summarise the action.
- **Tabs:** underline style (Linear/Vercel), not pills.
- **Charts (Recharts):** line/area with 1.5-2px stroke, area fill 8-10% primary, no gradients, horizontal gridlines only `stroke: hsl(var(--border))`, axis text 12px muted, custom tooltip = small white card with border; bar charts thin with 4px radius top. Gauges -> prefer bullet/progress bars (skill guidance) with number + text label.
- **Icons:** lucide only, 16px (20px in empty states), `stroke-width 1.75`; decorative icons `aria-hidden`. No emoji.
- **Empty/loading/error:** skeletons matching layout; empty state = 40px muted icon, title, one line, one action; errors inline with retry and correlation id.
- **AI content:** mark with a small "AI" chip (`Sparkles` icon, blue tint) - no violet gradients. Facts / Estimates / Assumptions / Missing data stay visibly labelled (AC-03); missing data in an amber Alert, never hidden.

## 5. Motion (subtle)
150-200ms `ease-out` for hover/colour; 200ms fade + 4-8px rise on page/section enter (no stagger chains longer than 4); dialogs scale 98%->100%; no count-up animations, no pulsing except the small "Live" dot; respect `prefers-reduced-motion`. `cursor-pointer` on every clickable.

## 6. UX rules
- Each page leads with what needs attention (summary row), then detail.
- Data density over decoration; align numbers; consistent date format "2 Dec 2026, 10:15".
- Confirm dialogs for approve/reject/destructive; toasts for every mutation result.
- Keyboard: visible focus everywhere, Ctrl/Cmd+K, Esc closes overlays, tables reachable.
- Performance: no new heavy deps (no animation libs; CSS transitions only), lazy-load route chunks (React.lazy per page) to cut the 700kB bundle.

## Pre-delivery checklist (from ui-ux-pro-max)
No emoji icons - cursor-pointer on clickables - hover transitions 150-300ms - text contrast >= 4.5:1 - visible focus - reduced motion respected - responsive at 375/768/1024/1440 - zero console errors.
