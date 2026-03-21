# AICount - Project Overview

AICount is a Thai accounting SaaS application.

## Purpose
Handles document OCR, journal entry workflows, WHT certificates, VAT rules, bank reconciliation, and multi-tenant workspaces for Thai accounting.

## Tech Stack
- **Framework:** Next.js 16 (App Router) with React 19
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 (`@import "tailwindcss"`, `@theme inline`)
- **Database:** Supabase (PostgreSQL) via Drizzle ORM
- **Auth:** Supabase SSR (`@supabase/ssr`)
- **State:** Zustand (client), React Query (`@tanstack/react-query`)
- **Background Jobs:** Inngest
- **Icons:** Lucide React (only icon library allowed)
- **PDF:** `@react-pdf/renderer`
- **Charts:** Recharts
- **Validation:** Zod v4
- **Email:** Resend
- **AI:** Anthropic SDK (`@anthropic-ai/sdk`)
- **Messaging:** LINE Bot SDK

## Project Structure
```
src/
  app/
    (app)/          # Authenticated app pages
    (auth)/         # Auth pages (login, signup, invite)
    api/            # API route handlers
  components/       # Shared UI components (flat structure)
  lib/
    api/            # API utilities (rate limiting)
    db/             # Drizzle schema, relations, queries
    inngest/        # Background job definitions
    services/       # Business logic (OCR, VAT, WHT, audit)
    supabase/       # Supabase client + middleware
    utils/          # Constants, formatters
  types/            # Domain and API type definitions
supabase/
  migrations/       # SQL migrations
scripts/            # Utility scripts
```
