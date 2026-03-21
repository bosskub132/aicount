# Deployment and Cutover Checklist

## Pre-deploy
- Fill `.env.local` with production keys (`Supabase`, `Anthropic`, `Inngest`, `LINE`, `Resend`).
- Run `npm ci`, `npm run lint`, `npm run build`.
- Apply SQL migrations on Supabase.
- Validate RLS policies with maker/checker/admin test users.

## Data migration
- Run `npm run migrate:legacy` after setting `MONGODB_URI` and `SUPABASE_DB_URL`.
- Compare document counts and random samples between MongoDB and PostgreSQL.
- Re-upload binary files to Supabase Storage and verify links.

## Cutover
- Set Vercel project environment variables.
- Deploy to preview and execute smoke tests:
  - upload single + batch
  - OCR processing
  - submit + approve + reject
  - export + download manifest
  - LINE webhook callback
- Switch DNS to Vercel production URL.
- Monitor logs and error rates for 48 hours.

## Rollback
- Keep old backend in read-only mode for 7 days.
- Revert DNS if blocking errors appear.
- Restore latest PostgreSQL snapshot if data corruption is detected.

