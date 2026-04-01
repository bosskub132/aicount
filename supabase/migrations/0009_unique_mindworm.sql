CREATE TABLE "cross_tenant_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern_type" text NOT NULL,
	"trigger_key" text NOT NULL,
	"field_name" text NOT NULL,
	"suggested_value" text NOT NULL,
	"tenant_count" integer DEFAULT 1 NOT NULL,
	"sample_count" integer DEFAULT 1 NOT NULL,
	"accept_count" integer DEFAULT 0 NOT NULL,
	"dismiss_count" integer DEFAULT 0 NOT NULL,
	"agreement_ratio" numeric(3, 2) NOT NULL,
	"confidence" numeric(3, 2) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "industry" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "company_size" text;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_patterns_unique" ON "cross_tenant_patterns" USING btree ("pattern_type","trigger_key","field_name","suggested_value");--> statement-breakpoint
CREATE INDEX "idx_patterns_lookup" ON "cross_tenant_patterns" USING btree ("pattern_type","trigger_key");