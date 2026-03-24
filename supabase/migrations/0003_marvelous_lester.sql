ALTER TABLE "customers" ADD COLUMN "branch_number" varchar(20);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "issuer_branch" varchar(20);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "wht_income_type" varchar(50);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "wht_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "vendor_type" varchar(20) DEFAULT 'company' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "is_non_resident" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "branch_number" varchar(20);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "country" varchar(100);