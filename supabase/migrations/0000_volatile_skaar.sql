CREATE TYPE "public"."account_category" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense');--> statement-breakpoint
CREATE TYPE "public"."assignment_role" AS ENUM('maker', 'checker');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('REVENUE', 'EXPENSE');--> statement-breakpoint
CREATE TYPE "public"."doc_type" AS ENUM('RECEIPT', 'INVOICE', 'PO', 'CREDIT_NOTE', 'DEBIT_NOTE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('DRAFT', 'OCR_PROCESSING', 'QUERY', 'ACTION_REQUIRED', 'PENDING_APPROVAL', 'REJECTED', 'APPROVED', 'EXPORTED', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."intake_source" AS ENUM('FRONTEND_UPLOAD', 'LINE');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'expired');--> statement-breakpoint
CREATE TYPE "public"."journal_type" AS ENUM('RV', 'SV', 'PV', 'PurV', 'JV');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'maker', 'checker');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"metadata" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"statement_date" date NOT NULL,
	"balance" numeric(15, 2),
	"line_items" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chart_of_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"account_code" varchar(20) NOT NULL,
	"account_name" text NOT NULL,
	"category" "account_category" NOT NULL,
	"is_suspense" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tax_id" varchar(13) NOT NULL,
	"name" text NOT NULL,
	"credit_term_days" integer DEFAULT 30,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"dept_code" varchar(20) NOT NULL,
	"dept_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"intake_source" "intake_source" DEFAULT 'FRONTEND_UPLOAD' NOT NULL,
	"file_url" text,
	"file_hash" varchar(64),
	"batch_id" uuid,
	"linked_po_id" uuid,
	"reverses_document_id" uuid,
	"parent_document_id" uuid,
	"issuer_tax_id" varchar(13),
	"issuer_name" text,
	"document_number" varchar(100),
	"document_date" date,
	"subtotal" numeric(15, 2),
	"vat_amount" numeric(15, 2),
	"grand_total" numeric(15, 2),
	"wht_amount" numeric(15, 2),
	"direction" "direction",
	"doc_type" "doc_type",
	"status" "document_status" DEFAULT 'DRAFT' NOT NULL,
	"journal_type" "journal_type",
	"voucher_no" varchar(50),
	"confidence_score" numeric(5, 2),
	"ocr_raw" jsonb,
	"rejection_comment" text,
	"currency" varchar(3) DEFAULT 'THB',
	"exchange_rate" numeric(15, 6),
	"version" integer DEFAULT 1 NOT NULL,
	"void_reason" text,
	"wht_certificate_path" text,
	"approved_by" uuid,
	"approved_at" timestamp,
	"exported_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_template_selections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"document_ids" jsonb DEFAULT '[]'::jsonb,
	"exported_at" timestamp DEFAULT now() NOT NULL,
	"exported_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "express_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"template_id" varchar(50) NOT NULL,
	"name" text NOT NULL,
	"journal_types" jsonb DEFAULT '[]'::jsonb,
	"category_keywords" jsonb DEFAULT '[]'::jsonb,
	"direction" "direction",
	"accounting_part" text,
	"template_group" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gl_mapping_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"keyword_pattern" text NOT NULL,
	"expense_gl" varchar(20),
	"income_gl" varchar(20),
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "assignment_role" NOT NULL,
	"invited_by" uuid NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"token" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"account_code" varchar(20) NOT NULL,
	"dept_code" varchar(20),
	"debit" numeric(15, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(15, 2) DEFAULT '0' NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email_on_reject" boolean DEFAULT true NOT NULL,
	"email_on_pending" boolean DEFAULT true NOT NULL,
	"email_weekly_digest" boolean DEFAULT false NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "period_locks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"year_month" varchar(7) NOT NULL,
	"locked_by" uuid NOT NULL,
	"locked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"item_code" varchar(50) NOT NULL,
	"item_name" text NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb,
	"income_gl" varchar(20),
	"expense_gl" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" "user_role" DEFAULT 'maker' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_onboarding_complete" boolean DEFAULT false NOT NULL,
	"onboarding_step" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "assignment_role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"tax_id" varchar(13) NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"is_vat_registered" boolean DEFAULT true,
	"base_currency" varchar(3) DEFAULT 'THB',
	"data_retention_years" integer DEFAULT 7,
	"default_export_template_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tax_id" varchar(13) NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"default_expense_gl" varchar(20),
	"default_wht_rate" numeric(5, 2) DEFAULT '3.00',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_template_selections" ADD CONSTRAINT "export_template_selections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_template_selections" ADD CONSTRAINT "export_template_selections_template_id_express_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."express_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_template_selections" ADD CONSTRAINT "export_template_selections_exported_by_profiles_id_fk" FOREIGN KEY ("exported_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "express_templates" ADD CONSTRAINT "express_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_mapping_rules" ADD CONSTRAINT "gl_mapping_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_locks" ADD CONSTRAINT "period_locks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_locks" ADD CONSTRAINT "period_locks_locked_by_profiles_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_assignments" ADD CONSTRAINT "tenant_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_assignments" ADD CONSTRAINT "tenant_assignments_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_tenant_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "bank_stmt_tenant_idx" ON "bank_statements" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coa_tenant_code_idx" ON "chart_of_accounts" USING btree ("tenant_id","account_code");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_tenant_tax_idx" ON "customers" USING btree ("tenant_id","tax_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dept_tenant_code_idx" ON "departments" USING btree ("tenant_id","dept_code");--> statement-breakpoint
CREATE INDEX "doc_tenant_status_idx" ON "documents" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "doc_tenant_date_idx" ON "documents" USING btree ("tenant_id","document_date");--> statement-breakpoint
CREATE INDEX "doc_batch_idx" ON "documents" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "doc_file_hash_idx" ON "documents" USING btree ("tenant_id","file_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "express_tpl_tenant_id_idx" ON "express_templates" USING btree ("tenant_id","template_id");--> statement-breakpoint
CREATE INDEX "gl_rule_tenant_idx" ON "gl_mapping_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_token_idx" ON "invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "invitation_tenant_idx" ON "invitations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "jl_document_idx" ON "journal_lines" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "notif_user_read_idx" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE UNIQUE INDEX "period_lock_tenant_ym_idx" ON "period_locks" USING btree ("tenant_id","year_month");--> statement-breakpoint
CREATE UNIQUE INDEX "product_tenant_code_idx" ON "products" USING btree ("tenant_id","item_code");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_user_role_idx" ON "tenant_assignments" USING btree ("tenant_id","user_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_tenant_tax_idx" ON "vendors" USING btree ("tenant_id","tax_id");