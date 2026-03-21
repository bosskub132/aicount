# Fresh-Start Bootstrap Checklist

Use this checklist when starting with new data (no legacy migration).

## 1) Environment
- Copy `.env.example` to `.env.local`.
- Fill required keys:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_DB_URL`
  - `ANTHROPIC_API_KEY`
  - `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`
  - `NEXT_PUBLIC_APP_URL`
- Optional (if used from day 1): `LINE_*`, `RESEND_API_KEY`.

## 2) Database + App Sanity
- Apply schema: `npx drizzle-kit push`
- Start app: `npm run dev`
- Start Inngest dev: `npx inngest-cli@latest dev`
- Check health endpoint: `GET /api/health`

## 3) Bootstrap First Workspace
- Sign up first admin user in UI (`/signup`).
- Create first tenant/workspace via `POST /api/tenants`.
- Assign maker/checker via `POST /api/tenants/:id/assignments`.
- Set workspace UUID in header workspace selector.

## 4) Seed Master Data (minimum)
- COA:
  - Add cash/bank, AR/AP, revenue, expense, VAT input/output, suspense.
- Vendors/Customers:
  - Add top counterparties and tax IDs.
- Products:
  - Add item keywords with `incomeGl` / `expenseGl`.
- Departments:
  - Add at least one default dept code.
- Export template:
  - Configure default template for tenant.

## 5) First Workflow Smoke (real usage path)
- Upload one single document and one batch.
- Confirm OCR status transitions (`OCR_PROCESSING` -> `QUERY`/`ACTION_REQUIRED`/`PENDING_APPROVAL`).
- Edit and submit one document.
- Approve one, reject one (with comment), verify notification.
- Run export and download output.
- Open period lock page and lock one month.

## 6) Production Readiness (fresh-start mode)
- Run preflight:
  - `npm run release:preflight -- --baseUrl=https://<domain>`
- Deploy:
  - `npx vercel --prod --yes`
  - or GitHub workflow `Deploy Vercel`
- After deploy:
  - Re-run smoke on production URL.
  - Enable LINE and email notifications if needed.

