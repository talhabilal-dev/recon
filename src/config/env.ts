import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),

  DATABASE_URL: z.string().min(1),

  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_ACCESS_KEY: z.string().min(1),

  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.4-mini"),
});

// Exported-but-empty variables (e.g. `PORT=`) should behave as unset.
const source = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== undefined && value !== ""),
);

const parsed = envSchema.safeParse(source);

if (!parsed.success) {
  console.error(
    `Invalid environment variables:\n${z.prettifyError(parsed.error)}`,
  );
  process.exit(1);
}

export const env = parsed.data;
