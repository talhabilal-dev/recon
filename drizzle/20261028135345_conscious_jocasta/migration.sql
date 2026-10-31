CREATE TYPE "expense_category" AS ENUM('rent', 'salaries', 'marketing', 'utilities', 'software', 'other');--> statement-breakpoint
CREATE TYPE "order_status" AS ENUM('pending', 'completed', 'cancelled', 'returned');--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" serial PRIMARY KEY,
	"user_id" uuid,
	"user_prompt" text NOT NULL,
	"steps_log" text,
	"status" text DEFAULT 'running' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"city" text,
	"country" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY,
	"category" "expense_category" NOT NULL,
	"description" text,
	"amount" numeric(12,2) NOT NULL,
	"expense_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(12,2) NOT NULL,
	"unit_cost" numeric(12,2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY,
	"customer_id" integer NOT NULL,
	"order_date" timestamp NOT NULL,
	"status" "order_status" NOT NULL,
	"payment_method" text NOT NULL,
	"discount_amount" numeric(12,2) DEFAULT '0' NOT NULL,
	"shipping_cost" numeric(12,2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(12,2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"category_id" integer NOT NULL,
	"sell_price" numeric(12,2) NOT NULL,
	"cost_price" numeric(12,2) NOT NULL,
	"stock_qty" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY,
	"user_id" uuid,
	"title" text NOT NULL,
	"question" text,
	"generated_sql" text,
	"result_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" serial PRIMARY KEY,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"refund_amount" numeric(12,2) NOT NULL,
	"reason" text,
	"returned_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_expenses_date" ON "expenses" ("expense_date");--> statement-breakpoint
CREATE INDEX "idx_items_order" ON "order_items" ("order_id");--> statement-breakpoint
CREATE INDEX "idx_items_product" ON "order_items" ("product_id");--> statement-breakpoint
CREATE INDEX "idx_orders_date" ON "orders" ("order_date");--> statement-breakpoint
CREATE INDEX "idx_orders_status" ON "orders" ("status");--> statement-breakpoint
CREATE INDEX "idx_orders_customer" ON "orders" ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_products_category" ON "products" ("category_id");--> statement-breakpoint
CREATE INDEX "idx_returns_order" ON "returns" ("order_id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id");--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");