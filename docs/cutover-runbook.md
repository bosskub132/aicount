# Cutover Runbook (Phase 4)

## Preconditions
- `npm run lint` and `npm run build` pass on release commit.
- Migration verification completed.
- Production env variables configured on Vercel.
- GitHub secrets configured (optional auto deploy workflow):
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`

## Cutover Sequence
1. Enable maintenance window on old system (read-only mode).
2. Run final delta migration.
3. Deploy release to Vercel production.
   - Manual: `npx vercel --prod --yes`
   - CI/CD: run GitHub Action `Deploy Vercel`
4. Execute smoke tests:
   - `npm run smoke:test -- --baseUrl=https://<your-prod-domain>`
   - verify `GET /api/health` returns `ok: true`
   - login/signup
   - upload single + batch
   - OCR processing + re-OCR
   - submit/approve/reject workflow
   - export and download
5. Switch DNS to Vercel.
6. Monitor for 24-48h (error rate, latency, failed jobs).

## Backout
- Revert DNS.
- Re-enable old backend writes.
- Communicate incident and recovery ETA.

## Post-cutover
- Keep old backend read-only for 7 days.
- Archive old infra after sign-off.

