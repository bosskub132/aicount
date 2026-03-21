# AiCount - OCR to GL Accounting System

Multi-tenant accounting SaaS that automates document processing from OCR extraction to General Ledger journal entries, with export to Express Accounting Software.

## Tech Stack

- **Framework:** Next.js 14+ (App Router) on Vercel
- **Database:** Supabase (PostgreSQL) + Drizzle ORM
- **Auth:** Supabase Auth with RLS multi-tenant isolation
- **Storage:** Supabase Storage
- **Background Jobs:** Inngest
- **OCR:** Claude API (Anthropic)
- **UI:** shadcn/ui + Tailwind CSS
- **State:** Zustand (UI) + TanStack Query (server)

## Getting Started

1. **Clone and install:**
   ```bash
   npm install
   ```

2. **Set up Supabase:**
   - Create a project at [supabase.com](https://supabase.com)
   - Copy `.env.example` to `.env.local` and fill in credentials

3. **Run database migrations:**
   ```bash
   npx drizzle-kit push
   ```

4. **Start dev server:**
   ```bash
   npm run dev
   ```

5. **Start Inngest dev server** (separate terminal):
   ```bash
   npx inngest-cli@latest dev
   ```

## Project Structure

```
src/
  app/              # Next.js pages + API routes
    (auth)/         # Login, Signup (no sidebar)
    (app)/          # Main app (with sidebar layout)
    api/            # REST API endpoints + Inngest webhook
  components/       # React components (ui/, layout/, documents/, etc.)
  lib/
    db/             # Drizzle schema, relations, queries
    services/       # Business logic (OCR, classification, export, etc.)
    inngest/        # Background job definitions
    supabase/       # Supabase client configs
    utils/          # Shared utilities (formatting, constants)
  types/            # TypeScript type definitions
  hooks/            # React hooks
supabase/
  migrations/       # SQL migration files
```

## Key Concepts

- **Tenant** = Client company (multi-tenant via RLS)
- **Document** = Uploaded bill/invoice/receipt
- **Journal Lines** = Debit/Credit entries per document
- **Maker/Checker** = Two-person approval workflow
- **Express Export** = `.txt` format for Express Accounting Software

## Operational Runbooks

- Fresh-start bootstrap: `docs/fresh-start-bootstrap-checklist.md`
- Data migration: `docs/data-migration-runbook.md`
- Cutover/deploy: `docs/cutover-runbook.md`
