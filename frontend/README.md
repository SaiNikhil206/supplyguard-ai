# frontend/ - React SaaS UI

Owner: **Roop** (R-01, R-03 .. R-10). Starts against MSW mock data, switches to the real API with `VITE_API_MOCK=false`. Vite + React 18 + TypeScript + Tailwind + TanStack Query + Recharts.
Screens: Executive Overview, Supplier Intelligence, Risk Command Center, AI Recommendations, Approval Center, What-if Simulator, Integration Center, Audit Center, Tenant Settings.
API types are generated from the backend OpenAPI schema (`/api/schema/`).

## Develop

    cd frontend
    cp .env.example .env   # VITE_API_MOCK=true uses MSW mock data
    npm install
    npm run dev            # http://localhost:5173, /api proxied to localhost:8000
    npm test               # Vitest + Testing Library
    npm run build          # tsc -b && vite build

Layout: src/app providers, src/theme light/dark, src/layout shell + nav, src/pages the 9 screens, src/router.tsx routes, src/test helpers. Design tokens are CSS variables in src/index.css, mapped in tailwind.config.js (bg-surface, text-muted, bg-sev-critical).

## UI kit

`src/components/ui/` is the design-system kit (import from `@/components/ui`). Token classes only (no hex), keyboard/ARIA friendly.
Button (variant, size, loading), Card/CardHeader/CardTitle/CardBody, Badge (tone), SeverityBadge, StatusBadge (RiskCase states), KpiTile (delta, hint, loading), Spinner, Skeleton, EmptyState, ErrorState (correlationId, onRetry), Input/Select/Field, Table/THead/TBody/TR/TH/TD/TableEmptyRow, Money + formatMoney, EvidenceTag (FACT/ESTIMATE/ASSUMPTION/MISSING_DATA, label + glyph + border style).
