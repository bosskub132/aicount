CREATE TYPE "public"."journal_status" AS ENUM('draft', 'posted', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."match_type" AS ENUM('auto', 'manual');--> statement-breakpoint
ALTER TYPE "public"."journal_type" ADD VALUE 'Manual';--> statement-breakpoint
CREATE TABLE "bank_recon_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_transaction_id" uuid NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"match_type" "match_type" NOT NULL,
	"confidence" numeric(5, 2),
	"confirmed_at" timestamp,
	"confirmed_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_statement_id" uuid NOT NULL,
	"transaction_date" date NOT NULL,
	"description" text NOT NULL,
	"debit" numeric(15, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(15, 2) DEFAULT '0' NOT NULL,
	"reference_no" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"jv_number" varchar(50) NOT NULL,
	"date" date NOT NULL,
	"type" "journal_type" NOT NULL,
	"description" text NOT NULL,
	"status" "journal_status" DEFAULT 'draft' NOT NULL,
	"source_document_id" uuid,
	"reversed_from_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"journal_entry_id" uuid,
	"amount" numeric(15, 2) NOT NULL,
	"wht_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(15, 2) NOT NULL,
	"payment_date" date NOT NULL,
	"payment_method" varchar(50),
	"reference_no" varchar(100),
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"report_type" varchar(50) NOT NULL,
	"period" varchar(20) NOT NULL,
	"period_scope" varchar(20) NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"filters" jsonb,
	"pdf_storage_path" text,
	"pdf_size_bytes" integer,
	"generated_by" uuid,
	"locked_at" timestamp,
	"locked_by" uuid,
	"deleted_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_retention_policy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"draft_retention_days" integer DEFAULT 30 NOT NULL,
	"trash_recovery_days" integer DEFAULT 7 NOT NULL,
	"financial_retention_value" integer DEFAULT 7 NOT NULL,
	"financial_retention_unit" varchar(10) DEFAULT 'years' NOT NULL,
	"tax_retention_value" integer DEFAULT 7 NOT NULL,
	"tax_retention_unit" varchar(10) DEFAULT 'years' NOT NULL,
	"wht_retention_value" integer DEFAULT 7 NOT NULL,
	"wht_retention_unit" varchar(10) DEFAULT 'years' NOT NULL,
	"management_retention_value" integer DEFAULT 2 NOT NULL,
	"management_retention_unit" varchar(10) DEFAULT 'years' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "report_retention_policy_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
ALTER TABLE "journal_lines" ALTER COLUMN "document_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD COLUMN "cash_flow_category" varchar(20);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD COLUMN "journal_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "next_jv_sequence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_recon_matches" ADD CONSTRAINT "bank_recon_matches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_recon_matches" ADD CONSTRAINT "bank_recon_matches_bank_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("bank_transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_recon_matches" ADD CONSTRAINT "bank_recon_matches_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_recon_matches" ADD CONSTRAINT "bank_recon_matches_confirmed_by_profiles_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_statement_id_bank_statements_id_fk" FOREIGN KEY ("bank_statement_id") REFERENCES "public"."bank_statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_history" ADD CONSTRAINT "report_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_history" ADD CONSTRAINT "report_history_generated_by_profiles_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_history" ADD CONSTRAINT "report_history_locked_by_profiles_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_retention_policy" ADD CONSTRAINT "report_retention_policy_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_retention_policy" ADD CONSTRAINT "report_retention_policy_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brm_bank_tx_idx" ON "bank_recon_matches" USING btree ("bank_transaction_id");--> statement-breakpoint
CREATE INDEX "brm_tenant_confirmed_idx" ON "bank_recon_matches" USING btree ("tenant_id","confirmed_at");--> statement-breakpoint
CREATE INDEX "btx_statement_idx" ON "bank_transactions" USING btree ("bank_statement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "je_tenant_jv_idx" ON "journal_entries" USING btree ("tenant_id","jv_number");--> statement-breakpoint
CREATE INDEX "je_tenant_date_idx" ON "journal_entries" USING btree ("tenant_id","date");--> statement-breakpoint
CREATE INDEX "je_tenant_status_idx" ON "journal_entries" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "je_source_doc_idx" ON "journal_entries" USING btree ("source_document_id");--> statement-breakpoint
CREATE INDEX "pmt_tenant_doc_idx" ON "payments" USING btree ("tenant_id","document_id");--> statement-breakpoint
CREATE INDEX "pmt_tenant_date_idx" ON "payments" USING btree ("tenant_id","payment_date");--> statement-breakpoint
CREATE UNIQUE INDEX "report_history_draft_idx" ON "report_history" USING btree ("tenant_id","report_type","period","period_scope") WHERE locked_at IS NULL AND deleted_at IS NULL;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jl_journal_entry_idx" ON "journal_lines" USING btree ("journal_entry_id");