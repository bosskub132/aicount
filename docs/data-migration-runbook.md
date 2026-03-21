# Data Migration Runbook (Phase 3)

## Preconditions
- Production Supabase project is ready.
- Legacy MongoDB credentials available (`MONGODB_URI`).
- `.env.local` contains `SUPABASE_DB_URL`.
- Backup snapshot of legacy DB completed.

## Steps
1. Run schema migrations on Supabase.
2. Initialize export template directory (optional helper):
   - `npm run legacy:template -- --output=<export-dir>`
3. Export legacy datasets from MongoDB into JSON arrays in one directory:
   - `tenants.json`, `profiles.json`, `tenant_assignments.json`
   - `chart_of_accounts.json`, `vendors.json`, `customers.json`, `products.json`, `departments.json`
   - `documents.json`, `journal_lines.json`
4. Verify target schema and RLS readiness with `npm run db:health`.
5. Execute import with `npm run migrate:legacy -- --input=<export-dir>`.
6. Upload raw document files to Supabase Storage.
7. Generate reconciliation report with `npm run reconcile:legacy -- --input=<export-dir>`.
8. Review `<export-dir>/migration-report.json` and `<export-dir>/reconciliation-report.json`.

## Verification
- Row counts match expected range per tenant.
- Random sample (>=50 docs) validated for totals, tax fields, status.
- Spot-check journal balance on migrated entries.
- Verify RLS by logging in as maker/checker/admin.

## Rollback
- Stop write traffic.
- Restore Supabase snapshot.
- Re-run migration after root-cause fix.

