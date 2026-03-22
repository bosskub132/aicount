# Deployment Patterns & Gotchas

## Migration Order
Always run migrations BEFORE deploying code. New nullable columns are safe — old code ignores them.

## Common Pitfalls
1. **CSRF 403s** — `NEXT_PUBLIC_APP_URL` must exactly match the production domain. If wrong, all POST/PUT/DELETE requests fail.
2. **Email verification lockout** — If Supabase email confirmation was previously disabled, existing users have `email_confirmed_at = NULL`. Run `UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;` before deploying middleware that checks this.
3. **Onboarding redirect loop** — Existing users with `is_onboarding_complete = false` will be stuck in onboarding. Run `UPDATE profiles SET is_onboarding_complete = true, onboarding_step = 6 WHERE is_onboarding_complete = false;` before deploy.
4. **Stale refresh tokens** — Middleware wraps `supabase.auth.getUser()` in try-catch. If token is expired, user is treated as unauthenticated and redirected to login.
5. **Zero UUID tenant scope** — `ensureTenantScope` now returns false for `00000000-...`. Any API call without proper `x-tenant-id` header gets 403.

## Rollback
- Code revert is safe — new DB columns are nullable, ignored by old code
- Do NOT rollback migrations — they are backward compatible
- Migration 0002 (marking users verified) is permanent but harmless
