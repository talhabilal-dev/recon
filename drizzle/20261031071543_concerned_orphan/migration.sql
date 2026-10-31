ALTER TABLE "reports" ADD COLUMN "run_id" integer;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "pdf_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "pdf_path" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "pdf_error" text;