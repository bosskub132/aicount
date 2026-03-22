ALTER TABLE "profiles" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "deletion_scheduled_for" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "deletion_scheduled_for" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "deletion_reason" text;
--> statement-breakpoint
CREATE INDEX idx_tenants_deletion_scheduled ON tenants (deletion_scheduled_for) WHERE deletion_scheduled_for IS NOT NULL;--> statement-breakpoint
CREATE INDEX idx_profiles_deletion_scheduled ON profiles (deletion_scheduled_for) WHERE deletion_scheduled_for IS NOT NULL;