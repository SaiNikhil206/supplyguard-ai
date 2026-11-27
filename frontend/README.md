# frontend/ - React SaaS UI

Owner: **Roop** (R-01, R-03 .. R-10). Starts against MSW mock data, switches to the real API with `VITE_API_MOCK=false`. Vite + React 18 + TypeScript + Tailwind + TanStack Query + Recharts.
Screens: Executive Overview, Supplier Intelligence, Risk Command Center, AI Recommendations, Approval Center, What-if Simulator, Integration Center, Audit Center, Tenant Settings.
API types are hand-written from `docs/CONTRACTS.md` until U-02 lands, then generated with openapi-typescript from the backend OpenAPI schema (`/api/schema/`).

## Develop

    cd frontend
    cp .env.example .env   # VITE_API_MOCK is commented out: unset = MSW mocks on in dev, off in prod build
    npm install            # needs Node >= 22.22.2 (see .nvmrc; engine-strict)
    npm run dev            # http://localhost:5173, /api proxied to localhost:8000
    npm test               # Vitest + Testing Library
    npm run build          # tsc -b && vite build

Layout: src/app providers, src/theme light/dark, src/layout shell + nav, src/pages the 9 screens, src/router.tsx routes, src/test helpers. Design tokens are CSS variables in src/index.css, mapped in tailwind.config.js (bg-surface, text-muted, bg-sev-critical).

## Run against the real backend (`VITE_API_MOCK=false`)

    # 1. backend (repo root; Postgres via docker, or DATABASE_URL=sqlite:///dev.sqlite3 for a quick local run)
    cd backend && python manage.py migrate
    DEMO_USER_PASSWORD='<a strong password>' python manage.py load_seed --demo-users   # acme.admin / acme.procurement / acme.viewer
    python manage.py runserver 8000
    # 2. frontend
    cd frontend && cp .env.example .env     # then set VITE_API_MOCK=false (optional: VITE_PROXY_TARGET=http://host:8000)
    npm run dev                             # /api is proxied to the backend; sign in with the seeded user

Tenant comes only from the JWT; there is no tenant field in any request. Tests always run in mock mode (MSW).
`src/api/realContract.test.ts` replays JSON captured from the real backend (`src/api/__fixtures__/real-*.json`) to catch serializer drift.
The seed has no risk cases; create some via the pipeline (or a dev script) to see the Risk Command Center populated.

## API layer and mocks

- `src/api/`: typed client (`client.ts`: JWT bearer, single-flight 401 refresh, `ApiError`), `tokens.ts`, `endpoints.ts`, `queries.ts` (TanStack hooks + `queryKeys`), `types.ts` (hand-written from CONTRACTS; replaced by openapi-typescript output after U-02).
- `src/mocks/`: MSW handlers + fixtures for tenant `TEN-ACME`. Browser worker starts in `main.tsx` when mocks are enabled (`VITE_API_MOCK=true`, or unset in dev; production builds default to off); Vitest uses the node server (`src/test/setup.ts`).
- Mock login users (password `demo123` for all):

| username | role |
|---|---|
| `admin` | ADMIN |
| `manager` | PROCUREMENT_MANAGER |
| `viewer` | VIEWER |

- Full case detail: `RC-000045` (factory outage at `SUP-1008`). Mock access tokens live 15 min, refresh 7 days.

## UI kit

`src/components/ui/` is the design-system kit (import from `@/components/ui`). Token classes only (no hex), keyboard/ARIA friendly.
Button (variant, size, loading), Card/CardHeader/CardTitle/CardBody, Badge (tone), SeverityBadge, StatusBadge (RiskCase states), KpiTile (delta, hint, loading), Spinner, Skeleton, EmptyState, ErrorState (correlationId, onRetry), Input/Select/Field, Table/THead/TBody/TR/TH/TD/TableEmptyRow, Money + formatMoney, EvidenceTag (FACT/ESTIMATE/ASSUMPTION/MISSING_DATA, label + glyph + border style).

## Design system

Built on [shadcn/ui](https://ui.shadcn.com) (the Tailwind v3 line, `shadcn@2.3.0` conventions; Tailwind stays on 3.x) with Radix primitives, `class-variance-authority`, `tailwind-merge` (`cn()` in `src/lib/utils.ts`), `tailwindcss-animate`, lucide-react icons, `cmdk` (command palette) and `sonner` (toasts). Component source is copied into `src/components/ui/` (PascalCase file names; Windows is case-insensitive, so no `button.tsx` next to `Button.tsx`). `components.json` points the shadcn CLI at `@/components/ui` and `@/lib/utils`.

- **Tokens**: `src/index.css` defines HSL triples (`--background`, `--foreground`, `--card`, `--primary`, `--accent`, `--destructive`, `--border`, `--ring`, `--radius: 0.75rem`, ...) for light and `.dark`. Legacy names (`bg`, `surface`, `surface-2`, `text`, `muted`, `primary-fg`, `success`, `warning`, `danger`, `info`, `sev-*`) are aliases kept in `tailwind.config.js`. `text-muted` is the muted text colour; for a muted *background* use `bg-surface-2` (not `bg-muted`).
- **Contrast**: `node scripts/check-contrast.mjs` checks every token pair against WCAG AA 4.5:1 in both themes.
- **Add a component**: `npx shadcn@2.3.0 add <name>` (or copy source from the shadcn docs), rename the file to PascalCase, import `cn` from `@/lib/utils`, use token classes only, export it from `src/components/ui/index.ts`, and add a test.
- **Toasts**: `import { toast } from '@/components/ui'`, then `toast.success('Saved')`. `<Toaster />` is mounted in `Providers`.
- **Shell**: `src/layout/` has the grouped, collapsible sidebar (mobile Sheet), breadcrumbs, Ctrl/Cmd+K command palette, theme toggle and user menu.

## Auth/token notes

- Access token is kept in memory, refresh token in localStorage (hackathon trade-off). Ask the backend to keep refresh lifetime short and refresh-token rotation off, otherwise multiple tabs can log each other out. Post-hackathon: move to an httpOnly cookie.
- Only a 400/401 from `/auth/refresh` logs the user out; network or 5xx errors keep the tokens.
