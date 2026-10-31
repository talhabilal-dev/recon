import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env.ts";
import { relations } from "./schema.ts";

/*
 * The connection is opened on first use, not at import. postgres() parses the
 * URL eagerly and throws on a malformed one, so an import-time connection would
 * take the whole process down with it — and a bad DATABASE_URL should not stop
 * the static site and the auth routes from serving.
 */
function connect() {
  // prepare: false is required when connecting through the Supabase transaction pooler.
  return postgres(env.DATABASE_URL, { prepare: false });
}

function build() {
  return drizzle({ client: getClient(), relations });
}

let connection: ReturnType<typeof connect> | undefined;
let database: ReturnType<typeof build> | undefined;

export function getClient() {
  connection ??= connect();
  return connection;
}

export function getDb() {
  database ??= build();
  return database;
}
