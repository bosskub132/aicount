CREATE TABLE "ai_extraction_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"rule_type" text NOT NULL,
	"trigger_key" text NOT NULL,
	"trigger_value" text NOT NULL,
	"field_name" text NOT NULL,
	"rule_text" text NOT NULL,
	"deterministic_value" text,
	"sample_count" integer DEFAULT 1 NOT NULL,
	"confidence" numeric(3, 2) DEFAULT '0.50' NOT NULL,
	"is_graduated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text NOT NULL,
	"gl_account_code" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_recon_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"amount_tolerance" numeric(10, 2) DEFAULT '0.50' NOT NULL,
	"date_range_days" integer DEFAULT 3 NOT NULL,
	"auto_match" boolean DEFAULT true NOT NULL,
	"match_by_reference" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bank_recon_settings_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "custom_export_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"column_mappings" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "customer_tax_id" varchar(13);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "reference_po" varchar(100);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "credit_due_date" date;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "discount_amount" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "extraction_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "extraction_failure_reason" text;--> statement-breakpoint
ALTER TABLE "ai_extraction_rules" ADD CONSTRAINT "ai_extraction_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_recon_settings" ADD CONSTRAINT "bank_recon_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_export_templates" ADD CONSTRAINT "custom_export_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_account_tenant_idx" ON "bank_accounts" USING btree ("tenant_id");