---
name: aicount-deploy-ops
description: >-
  Guides deployment, release preflight, database health checks, smoke tests,
  data migration, and operational procedures for aicount. Use when deploying to
  Vercel, running release checks, validating database state, performing legacy
  migrations, or troubleshooting production issues.
user_invocable: true
---

# aicount — deployment & operations

## When to use this skill

Read this before:
- Running **release preflight** or **smoke tests**
- Deploying to **Vercel** (preview or production)
- Running **database health checks** or **schema migrations**
- Performing **legacy data migration** (MongoDB → Supabase)
- **Bootstrapping a fresh environment** (new Supabase project)
- Troubleshooting **production incidents** or planning **rollback**

## Repo map (ops files)

| File | Role |
|------|------|
| `scripts/release-preflight.mjs` | Full pre-release pipeline (lint + build + smoke) |
| `scripts/smoke-test.mjs` | Endpoint health validation (3 endpoints) |
| `scripts/db-health-check.mjs` | Schema + RLS verification (14 tables) |
| `scripts/migrate-mongodb-to-supabase.mjs` | Legacy MongoDB → PostgreSQL migration |
| `scripts/reconcile-legacy-vs-postgres.mjs` | Post-migration data reconciliation |
| `scripts/init-legacy-export-template.mjs` | Bootstrap empty JSON templates for migration |
| `docs/cutover-runbook.md` | Production cutover procedure |
| `docs/data-migration-runbook.md` | Data migration steps |
| `docs/deployment-cutover-checklist.md` | Combined deployment checklist |
| `docs/fresh-start-bootstrap-checklist.md` | Greenfield setup (no legacy data) |

## Quick reference commands

### Pre-release validation

```bash
# Full preflight: lint → build → smoke tests
# Generates timestamped report in docs/reports/
npm run release:preflight -- --baseUrl=https://your-domain.com

# Smoke tests only (3 endpoints: health, export compat, inngest)
npm run smoke:test -- --baseUrl=https://your-domain.com

# Database schema + RLS check
npm run db:health
```

### Deployment

```bash
# Push schema to Supabase (dev)
npx drizzle-kit push

# Generate migration SQL
npx drizzle-kit generate

# Deploy to Vercel preview
npx vercel

# Deploy to Vercel production
npx vercel --prod --yes
```

### Legacy migration

```bash
# 1. Initialize empty JSON templates
npm run legacy:template -- --output=./legacy-export

# 2. Export MongoDB data into the 10 JSON files
# (manual step — populate tenants.json, profiles.json, etc.)

# 3. Run migration
npm run migrate:legacy -- --input=./legacy-export

# 4. Reconcile counts and journal balances
npm run reconcile:legacy -- --input=./legacy-export
```

## Environment variables required

| Variable | Purpose | Required for |
|----------|---------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | All |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Server-side |
| `SUPABASE_DB_URL` | PostgreSQL connection string | DB operations |
| `ANTHROPIC_API_KEY` | Claude AI for OCR | OCR processing |
| `INNGEST_EVENT_KEY` | Inngest event key | Background jobs |
| `INNGEST_SIGNING_KEY` | Inngest signing key | Background jobs |
| `NEXT_PUBLIC_APP_URL` | Application URL | Smoke tests |
| `LINE_CHANNEL_SECRET` | LINE bot secret | LINE webhook |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE bot token | LINE webhook |
| `LINE_DEFAULT_TENANT_ID` | Default tenant for LINE docs | LINE webhook |
| `LINE_DEFAULT_UPLOADED_BY` | Default uploader for LINE | LINE webhook |
| `RESEND_API_KEY` | Email delivery | Notifications |
| `MONGODB_URI` | Legacy MongoDB | Migration only |

## Fresh start bootstrap (no legacy data)

Follow `docs/fresh-start-bootstrap-checklist.md`:

### Phase 1: Environment
1. Copy `.env.example` → `.env.local`
2. Fill all required Supabase + Anthropic + Inngest keys

### Phase 2: Database + App
1. `npx drizzle-kit push` — apply schema
2. `npm run dev` — start Next.js
3. `npx inngest-cli@latest dev` — start Inngest dev server
4. Verify `GET /api/health` returns OK

### Phase 3: First workspace
1. Sign up admin via `/signup`
2. Create tenant via `POST /api/tenants`
3. Assign roles via `POST /api/tenants/:id/assignments`

### Phase 4: Seed master data
- Chart of Accounts: cash/bank, AR/AP, revenue, expense, VAT I/O, suspense
- Vendors/Customers with tax IDs
- Products with keywords + GL mappings
- Departments with codes
- Export templates

### Phase 5: Smoke test the workflow
1. Upload single + batch documents
2. Verify OCR status transitions
3. Edit, submit, approve, reject
4. Export and download
5. Lock one period

### Phase 6: Production deploy
1. `npm run release:preflight -- --baseUrl=https://domain`
2. `npx vercel --prod --yes`
3. Re-run smoke tests on production URL

## Production cutover (from legacy)

Follow `docs/cutover-runbook.md`:

### Preconditions
- [ ] Lint + build pass on release commit
- [ ] Migration verification completed
- [ ] Production env vars set on Vercel
- [ ] GitHub secrets configured (optional: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID)

### Cutover sequence
1. **Maintenance window** — set old system read-only
2. **Final delta migration** — run `npm run migrate:legacy` with latest data
3. **Deploy** — `npx vercel --prod --yes`
4. **Smoke tests** on production:
   - Health endpoint
   - Login/signup flow
   - Single + batch upload
   - OCR processing + re-OCR
   - Submit/approve/reject workflow
   - Export and download
5. **Switch DNS** to Vercel
6. **Monitor 24-48h** — error rate, latency, failed Inngest jobs

### Rollback procedure
1. Revert DNS to old system
2. Re-enable old backend writes
3. Communicate incident + recovery ETA
4. Keep old backend read-only for 7 days post-cutover

## Database health check details

`npm run db:health` validates:

**14 required tables:**
tenants, profiles, tenant_assignments, chart_of_accounts, vendors, customers, products, departments, documents, journal_lines, gl_mapping_rules, period_locks, bank_statements, export_template_selections

**Checks:**
- Missing tables → exit code 2
- RLS enablement status for each table
- Returns JSON: `{ checkedAt, missingTables[], tablesWithRls[] }`

## Release preflight details

`npm run release:preflight` runs sequentially:
1. `npm run lint` — ESLint
2. `npm run build` — Next.js production build
3. `npm run smoke:test` — 3-endpoint health check

**Output:** `docs/reports/preflight-YYYY-MM-DDTHH-MM-SS.json`
```json
{
  "generatedAt": "ISO timestamp",
  "baseUrl": "target URL",
  "passed": true/false,
  "results": [
    { "command": "npm run lint", "code": 0, "elapsedMs": 1234 }
  ]
}
```

**Exit code 2** if any check fails.

## Smoke test endpoints

| Endpoint | What it validates |
|----------|-------------------|
| `GET /api/health` | App is running, basic connectivity |
| `GET /api/export/express/compatibility` | Express export service is functional |
| `GET /api/inngest` | Inngest webhook handler responds |

## Data migration validation

After running `npm run migrate:legacy`, validate with:

```bash
npm run reconcile:legacy -- --input=./legacy-export
```

**Reconciliation checks:**
- Row count comparison: legacy JSON vs PostgreSQL (10 entity types)
- Unbalanced journal detection: documents where `|Σ debit - Σ credit| > 0.05`
- Output: `reconciliation-report.json`

**Manual validation (from runbook):**
- [ ] Row counts within expected range per tenant
- [ ] Random sample (>=50 docs) validates totals and tax fields
- [ ] Journal balance spot-check on migrated entries
- [ ] RLS verification — test as maker/checker/admin sees correct data

## Migration data format

10 JSON files expected in the input directory:

| File | Maps to table |
|------|---------------|
| `tenants.json` | tenants |
| `profiles.json` | profiles |
| `tenant_assignments.json` | tenant_assignments |
| `chart_of_accounts.json` | chart_of_accounts |
| `vendors.json` | vendors |
| `customers.json` | customers |
| `products.json` | products |
| `departments.json` | departments |
| `documents.json` | documents (27 fields) |
| `journal_lines.json` | journal_lines |

## Monitoring checklist (post-deploy)

- [ ] Error rate stable (check Vercel logs)
- [ ] API latency within acceptable range
- [ ] Inngest jobs completing (check Inngest dashboard)
- [ ] OCR processing pipeline functional
- [ ] Email notifications delivering (check Resend dashboard)
- [ ] LINE webhook responding (if enabled)
- [ ] No RLS policy errors in Supabase logs

## Pair with other skills

- **aicount-db-schema**: for schema migrations before deployment
- **aicount-inngest-jobs**: for background job health
- **aicount-backend-api**: for API route troubleshooting
