CREATE TABLE "ai_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"feature" text DEFAULT 'extraction' NOT NULL,
	"tier" integer,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "is_superadmin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "monthly_budget_usd" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "budget_alert_threshold" numeric(3, 2) DEFAULT '0.80';--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_usage_logs_tenant_date" ON "ai_usage_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_usage_logs_feature_date" ON "ai_usage_logs" USING btree ("feature","created_at");