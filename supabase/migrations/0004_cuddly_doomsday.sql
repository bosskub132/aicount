CREATE TABLE "wht_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"certificate_no" varchar(20) NOT NULL,
	"document_id" uuid NOT NULL,
	"payment_id" uuid,
	"vendor_id" uuid,
	"form_type" varchar(10) NOT NULL,
	"payee_name" text NOT NULL,
	"payee_tax_id" varchar(13) NOT NULL,
	"payee_branch" varchar(20) DEFAULT '00000',
	"payee_address" text,
	"payer_name" text NOT NULL,
	"payer_tax_id" varchar(13) NOT NULL,
	"payer_address" text,
	"payer_branch" varchar(20) DEFAULT '00000',
	"income_type" varchar(50) NOT NULL,
	"income_section" varchar(20) NOT NULL,
	"payment_date" date NOT NULL,
	"amount_paid" numeric(15, 2) NOT NULL,
	"wht_rate" numeric(5, 2) NOT NULL,
	"wht_amount" numeric(15, 2) NOT NULL,
	"pdf_storage_path" text,
	"pdf_size_bytes" integer,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"issued_by" uuid,
	"voided_at" timestamp,
	"voided_by" uuid,
	"void_reason" text,
	"replaces_id" uuid,
	"expires_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "branch_number" varchar(20) DEFAULT '00000';--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "next_wht_sequence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wht_certificates" ADD CONSTRAINT "wht_certificates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_certificates" ADD CONSTRAINT "wht_certificates_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_certificates" ADD CONSTRAINT "wht_certificates_issued_by_profiles_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wht_certificates" ADD CONSTRAINT "wht_certificates_voided_by_profiles_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wht_cert_tenant_no_idx" ON "wht_certificates" USING btree ("tenant_id","certificate_no");--> statement-breakpoint
CREATE INDEX "wht_cert_doc_idx" ON "wht_certificates" USING btree ("tenant_id","document_id");