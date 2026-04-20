-- Tax ID uniqueness (required so POST /api/tenants can return 409 on dup)
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_tax_id_unique" UNIQUE ("tax_id");--> statement-breakpoint

-- Add new columns
ALTER TABLE "profiles" ADD COLUMN "default_tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "is_onboarding_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "onboarding_step" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

-- Backfill tenant onboarding state from any assigned user's existing flag
UPDATE "tenants" t
SET is_onboarding_complete = true, onboarding_step = 8
WHERE EXISTS (
  SELECT 1 FROM "tenant_assignments" ta
  JOIN "profiles" p ON p.id = ta.user_id
  WHERE ta.tenant_id = t.id AND p.is_onboarding_complete = true
);--> statement-breakpoint

-- Set each user's default to their oldest tenant assignment
UPDATE "profiles" p
SET default_tenant_id = (
  SELECT ta.tenant_id FROM "tenant_assignments" ta
  WHERE ta.user_id = p.id
  ORDER BY ta.created_at ASC
  LIMIT 1
)
WHERE p.default_tenant_id IS NULL;--> statement-breakpoint

-- Drop legacy profile onboarding columns
ALTER TABLE "profiles" DROP COLUMN "is_onboarding_complete";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "onboarding_step";--> statement-breakpoint

-- Add FK constraint for default_tenant_id with ON DELETE SET NULL
ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_default_tenant_id_fkey"
  FOREIGN KEY ("default_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL;
