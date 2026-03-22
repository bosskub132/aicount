-- Ensure existing users are not locked out by new middleware checks.
--
-- 1. Mark all existing profiles as onboarding complete (they already have workspaces).
-- 2. Set onboarding_step to 6 (complete) for existing users.
-- 3. Confirm email for all existing auth users who haven't verified yet
--    (only needed if email confirmation was previously disabled in Supabase).

-- Mark existing profiles as onboarding complete
UPDATE profiles
SET is_onboarding_complete = true,
    onboarding_step = 6
WHERE is_onboarding_complete = false;

-- Confirm email for existing unverified auth users
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;
