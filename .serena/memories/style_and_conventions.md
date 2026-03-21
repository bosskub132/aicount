# Code Style & Conventions

## General
- TypeScript strict mode enabled
- Path alias: `@/` maps to `src/`
- Prefer Server Components by default; use `"use client"` only when needed
- Named exports for components: `export function ComponentName`

## File Organization
- Components: flat structure in `src/components/` (no `ui/` subfolder)
- Types: `src/types/` (domain.ts, api.ts) or inline
- API routes: `src/app/api/` using Next.js route handlers
- Business logic: `src/lib/services/`
- DB queries: `src/lib/db/queries/`
- Constants/enums: `src/lib/utils/constants.ts`

## Styling
- Tailwind CSS v4 with `@theme inline` in `globals.css`
- CSS variables: `--background`, `--foreground` in `:root`
- Always use Tailwind utility classes
- Never hardcode colors — use CSS variables or theme tokens
- Fonts: Geist Sans and Geist Mono

## Icons
- Only use `lucide-react` — no other icon libraries
- Import individually: `import { IconName } from "lucide-react"`

## Linting & Formatting
- ESLint with `eslint-config-next` (core-web-vitals + typescript)
- Prettier for formatting

## Localization
- Thai accounting app — some labels in Thai
- Number formatting follows Thai accounting conventions (`src/lib/utils/format.ts`)
