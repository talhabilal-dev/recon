import { createClient } from "@supabase/supabase-js";
import type { AuthUser } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";
import { env } from "./config/env.ts";
import { errors } from "./errors.ts";
import { logger } from "./logger.ts";

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_ACCESS_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;

  if (header === undefined || !header.startsWith("Bearer ")) {
    return undefined;
  }

  return header.slice("Bearer ".length);
}

export async function requireUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = bearerToken(req);

  if (token === undefined) {
    res.status(401).json({ error: errors.user.unauthorized });
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error) {
    logger.warn({ err: error }, "Rejected request with an invalid token");
    res.status(401).json({ error: errors.user.unauthorized });
    return;
  }

  req.user = data.user;
  next();
}

// Layered after requireUser. Anything that reads the books needs a confirmed
// address behind it, not just a valid token.
export function requireVerified(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.email_confirmed_at == null) {
    res.status(403).json({ error: errors.auth.emailNotConfirmed });
    return;
  }

  next();
}
