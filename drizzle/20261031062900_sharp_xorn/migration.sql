ALTER TABLE "agent_runs" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "total_tokens" integer;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "error" text;