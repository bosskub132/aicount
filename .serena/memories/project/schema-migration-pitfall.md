# Schema Migration Pitfall

Drizzle schema changes on feature branches (e.g. `feature/app-v2`) can cause runtime errors if the corresponding database migration is not applied to Supabase.

## Example (2026-03-24)
- `feature/app-v2` added `dueDate` to `documents` table in the Drizzle schema
- The database column was never created via migration
- Inngest `process-document` job failed with `column "due_date" does not exist` because `db.select()` selects all schema columns
- Fix: ran `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "due_date" date` on Supabase, added migration file `0003_add_due_date.sql`

## Takeaway
Always pair Drizzle schema changes with a corresponding SQL migration applied to the database, especially before deploying or if Vercel preview deployments auto-build feature branches.