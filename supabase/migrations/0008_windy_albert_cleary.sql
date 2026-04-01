CREATE TABLE "ai_duplicate_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"match_document_id" uuid NOT NULL,
	"match_type" text NOT NULL,
	"match_score" numeric(3, 2) NOT NULL,
	"match_details" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid,
	"feature" text NOT NULL,
	"field_name" text NOT NULL,
	"suggested_value" text NOT NULL,
	"confidence" numeric(3, 2) NOT NULL,
	"source" text NOT NULL,
	"source_context" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"final_value" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "file_hash" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "suggestions_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_duplicate_candidates" ADD CONSTRAINT "ai_duplicate_candidates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_duplicate_candidates" ADD CONSTRAINT "ai_duplicate_candidates_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_duplicate_candidates" ADD CONSTRAINT "ai_duplicate_candidates_match_document_id_documents_id_fk" FOREIGN KEY ("match_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_duplicates_document" ON "ai_duplicate_candidates" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_suggestions_document" ON "ai_suggestions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_suggestions_tenant_feature" ON "ai_suggestions" USING btree ("tenant_id","feature","created_at");