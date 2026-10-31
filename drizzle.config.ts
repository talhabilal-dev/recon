import { defineConfig } from "drizzle-kit";

/*
 * Migrations and introspection need the direct connection. Through the Supabase
 * transaction pooler (port 6543) drizzle-kit stalls on "Pulling schema from
 * database" and never returns, so prefer DIRECT_URL and fall back to the pooled
 * URL only when there is nothing else.
 */
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  /*
   * This project only owns the public schema. Without this, push introspects
   * Supabase's auth and extensions schemas too: it offers auth tables as rename
   * candidates for every new table, and it plans DROP statements for objects it
   * does not own such as extensions.pg_stat_statements.
   */
  schemaFilter: ["public"],
  // Only push/pull/migrate need credentials. Added conditionally so `generate`
  // still works with no database configured at all. drizzle-kit loads .env.
  ...(url === undefined ? {} : { dbCredentials: { url } }),
});
