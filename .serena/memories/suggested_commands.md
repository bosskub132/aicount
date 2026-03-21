# Suggested Commands

## Development
- `npm run dev` — Start Next.js dev server
- `npm run build` — Production build
- `npm start` — Start production server

## Code Quality
- `npm run lint` — Run ESLint (uses eslint-config-next with core-web-vitals + typescript)
- `npx prettier --write .` — Format code with Prettier

## Database
- `npx drizzle-kit generate` — Generate Drizzle migrations
- `npx drizzle-kit migrate` — Run migrations
- `npm run db:health` — Database health check

## Testing / Validation
- `npm run smoke:test` — Smoke tests
- `npm run release:preflight` — Pre-release checks

## Legacy Scripts
- `npm run migrate:legacy` — Migrate from MongoDB to Supabase
- `npm run reconcile:legacy` — Reconcile legacy vs Postgres data

## System Utils (Windows with bash shell)
- `git` — Version control
- `ls`, `find`, `grep` — File navigation (bash syntax, not Windows CMD)
- Forward slashes in paths, `/dev/null` not `NUL`
