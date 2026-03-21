# Style & Conventions

## Styling
- Tailwind CSS v4 with @theme inline in globals.css
- CSS variables for all colors — NEVER hardcode hex values in components
- Design tokens defined in :root in globals.css (see project/design-system memory)
- Fonts: Inter + Noto Sans Thai (primary), Geist Mono (monospace) — loaded via next/font/google
- NOTE: Geist Sans has been REMOVED in the Phase 1 plan (not yet implemented)

## Components
- All shared components in src/components/ (flat structure, no ui/ subfolder)
- Named exports: export function ComponentName
- "use client" only where interactivity requires it
- Icons: lucide-react ONLY — no other icon libraries, no inline SVGs, no emojis as icons
- forwardRef for input components
- Use existing component library (Button, Input, Badge, Modal, Toast, etc.) when available

## Code Patterns
- Path alias: @/ maps to src/
- Server Components by default, "use client" where needed
- Business logic in src/lib/services/
- Database queries in src/lib/db/queries/
- Constants in src/lib/utils/constants.ts
- Types in src/types/ (domain.ts, api.ts)
- State: Zustand (client), React Query (server)
- UI state (sidebar, toasts): src/lib/stores/ui-store.ts

## Thai Language
- HTML lang="th" set in root layout
- Noto Sans Thai for proper Thai character rendering
- Number formatting follows Thai accounting conventions (src/lib/utils/format.ts)
- Thai Buddhist Era year display where appropriate
