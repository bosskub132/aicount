# AICount - Project Rules

## Project Overview

AICount is a Thai accounting SaaS application built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, and Supabase (PostgreSQL via Drizzle ORM). It handles document OCR, journal entry workflows, WHT certificates, VAT rules, bank reconciliation, and multi-tenant workspaces.

## Tech Stack

- **Framework:** Next.js 16 (App Router) with React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 (using `@import "tailwindcss"` and `@theme inline` syntax)
- **Database:** Supabase (PostgreSQL) via Drizzle ORM
- **Auth:** Supabase SSR (`@supabase/ssr`)
- **State:** Zustand (client), React Query (`@tanstack/react-query`)
- **Background Jobs:** Inngest
- **Icons:** Lucide React
- **PDF:** `@react-pdf/renderer`
- **Charts:** Recharts
- **Validation:** Zod v4
- **Email:** Resend

## Project Structure

```
src/
  app/
    (app)/          # Authenticated app pages (upload, approvals, settings, etc.)
    (auth)/         # Auth pages (login, signup, invite)
    api/            # API route handlers
    layout.tsx      # Root layout
    globals.css     # Global styles + Tailwind theme tokens
  components/       # Shared UI components (flat structure, no ui/ subfolder)
  lib/
    api/            # API utilities (rate limiting, etc.)
    db/             # Drizzle schema, relations, queries
    inngest/        # Background job definitions
    services/       # Business logic (OCR, confidence, VAT, WHT, audit, etc.)
    supabase/       # Supabase client + middleware
    utils/          # Constants, formatters
  types/            # Domain and API type definitions
supabase/
  migrations/       # Drizzle-generated SQL migrations
public/             # Static assets (SVGs, generated files)
scripts/            # Utility scripts (migration, health checks, smoke tests)
```

## Coding Conventions

- Components are `"use client"` where needed; prefer Server Components by default
- Components use named exports (`export function ComponentName`)
- Types are defined inline or in `src/types/` (domain.ts, api.ts)
- API routes are in `src/app/api/` using Next.js route handlers
- Path alias: `@/` maps to `src/`
- Constants and enums are in `src/lib/utils/constants.ts`
- Business logic lives in `src/lib/services/`
- Database queries are in `src/lib/db/queries/`

## Design Tokens & Styling

- Tailwind CSS v4 with `@theme inline` in `globals.css`
- CSS variables: `--background`, `--foreground` defined in `:root`
- Fonts: Geist Sans (`--font-geist-sans`) and Geist Mono (`--font-geist-mono`)
- IMPORTANT: Use Tailwind utility classes for all styling
- IMPORTANT: Never hardcode colors - use CSS variables or Tailwind theme tokens

## Icon System

- IMPORTANT: Use `lucide-react` for all icons
- IMPORTANT: DO NOT install or import any other icon libraries
- Import icons individually: `import { IconName } from "lucide-react"`

## Asset Handling

- Static assets go in `public/`
- Generated files go in `public/generated/`
- IMPORTANT: If the Figma MCP server returns a localhost source for an image or SVG, use that source directly
- IMPORTANT: DO NOT use or create placeholders if a localhost source is provided

---

## Figma MCP Integration Rules

These rules define how to translate Figma inputs into code for this project. Follow them for every Figma-driven change.

### Required Flow (do not skip)

1. Run `get_design_context` first to fetch the structured representation for the exact node(s)
2. If the response is too large or truncated, run `get_metadata` to get the high-level node map, then re-fetch only the required node(s) with `get_design_context`
3. Run `get_screenshot` for a visual reference of the node variant being implemented
4. Only after you have both `get_design_context` and `get_screenshot`, download any assets needed and start implementation
5. Translate the output (usually React + Tailwind) into this project's conventions, styles, and framework
6. Validate against Figma for 1:1 look and behavior before marking complete

### Implementation Rules

- Treat Figma MCP output as a design reference, not final code
- Adapt output to Next.js App Router patterns (Server Components, `"use client"` where needed)
- Reuse existing components from `src/components/` instead of duplicating functionality
- Use the project's CSS variables and Tailwind theme tokens consistently
- Use `lucide-react` for icons - do not add new icon packages from Figma output
- Map Figma colors to existing CSS variables in `globals.css` or extend `@theme inline`
- Respect existing routing, state management (Zustand/React Query), and data-fetch patterns
- Place new shared components in `src/components/` (flat structure)
- Place page-specific components alongside their page in the App Router
- Strive for 1:1 visual parity with the Figma design
- Validate the final UI against the Figma screenshot for both look and behavior

### Responsive Design

- Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`)
- Mobile-first approach
- Test at common breakpoints: 375px, 768px, 1024px, 1440px

### Thai Language / Localization

- This is a Thai accounting application - some labels use Thai text
- Ensure proper font rendering for Thai characters
- Number formatting follows Thai accounting conventions (see `src/lib/utils/format.ts`)
