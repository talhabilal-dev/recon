import { join } from "node:path";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { pinoHttp } from "pino-http";
import type { AuthSession } from "@supabase/supabase-js";
import { serve } from "inngest/express";
import { z } from "zod";
import {
  askAgent,
  countConversations,
  countRuns,
  getRun,
  listConversationRuns,
  listConversations,
  recordRun,
} from "./agent.ts";
import { bearerToken, requireUser, requireVerified, supabase } from "./auth.ts";
import { errors } from "./errors.ts";
import { inngest, buildReportPdf, runAgent } from "./inngest.ts";
import { logger } from "./logger.ts";
import {
  getReport,
  insertReport,
  listReports,
  parseRunSteps,
} from "./reports.ts";

const BODY_LIMIT = "1mb";

// Sits one level below the repo root from both src/ and the compiled dist/.
const webDir = join(import.meta.dirname, "..", "web", "dist");

type HttpError = Error & { status?: number; statusCode?: number };

const signUpBody = z.object({
  email: z.email(),
  password: z.string().min(8),
});

// Sign-in only checks that a password was supplied, so an older shorter
// password is not rejected by us before Supabase can judge it.
const signInBody = z.object({
  email: z.email(),
  password: z.string().min(1),
});

// Supabase puts the type on the magic link itself, so it arrives from the URL.
const verifyBody = z.object({
  tokenHash: z.string().min(1),
  type: z.enum(["signup", "invite", "magiclink", "recovery", "email_change", "email"]),
});

const askBody = z.object({
  question: z.string().min(1).max(2000),
  // Lets several questions share one conversation; falls back to the user id.
  conversationId: z.string().min(1).max(120).optional(),
});

function toSession(session: AuthSession) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? null,
  };
}

export const app = express();

app.use(pinoHttp({ logger }));
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: false, limit: BODY_LIMIT }));
// After the body parsers: the Express adapter reads req.body, so mounting it
// ahead of express.json() leaves the handler with nothing to parse.
app.use(
  "/api/inngest",
  serve({ client: inngest, functions: [runAgent, buildReportPdf] }),
);
app.use(express.static(webDir));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/auth/signup", async (req, res) => {
  const body = signUpBody.safeParse(req.body);

  if (!body.success) {
    res.status(400).json({ error: errors.auth.invalidInput });
    return;
  }

  const { data, error } = await supabase.auth.signUp(body.data);

  if (error) {
    logger.warn({ err: error }, "Sign-up failed");

    if (error.code === "email_address_invalid") {
      res.status(400).json({ error: errors.auth.emailInvalid });
      return;
    }

    if (error.code === "user_already_exists") {
      res.status(409).json({ error: errors.auth.emailTaken });
      return;
    }

    res.status(400).json({ error: errors.auth.signUpFailed });
    return;
  }

  res.status(201).json({
    user: data.user,
    session: data.session ? toSession(data.session) : null,
    // With email confirmation on, Supabase returns a user but no session.
    needsEmailConfirmation: data.session === null,
  });
});

app.post("/auth/login", async (req, res) => {
  const body = signInBody.safeParse(req.body);

  if (!body.success) {
    res.status(400).json({ error: errors.auth.invalidInput });
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword(body.data);

  if (error) {
    logger.warn({ err: error }, "Sign-in failed");

    if (error.code === "email_not_confirmed") {
      res.status(403).json({ error: errors.auth.emailNotConfirmed });
      return;
    }

    res.status(401).json({ error: errors.auth.invalidCredentials });
    return;
  }

  res.json({ user: data.user, session: toSession(data.session) });
});

// A magic link can carry a token hash instead of a session, so the exchange
// happens here rather than in the browser.
app.post("/auth/verify", async (req, res) => {
  const body = verifyBody.safeParse(req.body);

  if (!body.success) {
    res.status(400).json({ error: errors.auth.invalidInput });
    return;
  }

  const { data, error } = await supabase.auth.verifyOtp({
    type: body.data.type,
    token_hash: body.data.tokenHash,
  });

  if (error) {
    logger.warn({ err: error }, "Email verification failed");
    res.status(400).json({ error: errors.auth.verifyFailed });
    return;
  }

  res.json({
    user: data.user,
    session: data.session ? toSession(data.session) : null,
  });
});

app.get("/auth/me", requireUser, (req, res) => {
  res.json({
    user: req.user,
    // What the dashboard gate keys off.
    emailVerified: req.user?.email_confirmed_at != null,
  });
});

// The agent reads the books, so it needs a confirmed account behind it.
app.post("/agent/ask", requireUser, requireVerified, async (req, res) => {
  const body = askBody.safeParse(req.body);

  if (!body.success) {
    res.status(400).json({ error: errors.user.badRequest });
    return;
  }

  const userId = req.user?.id;

  if (userId === undefined) {
    res.status(401).json({ error: errors.user.unauthorized });
    return;
  }

  const { question } = body.data;
  const conversationId = body.data.conversationId ?? userId;
  const startedAt = Date.now();

  try {
    const result = await askAgent(question, conversationId);
    const durationMs = Date.now() - startedAt;

    const runId = await recordRun({
      userId,
      question,
      conversationId,
      status: "completed",
      durationMs,
      ...result,
    });
    res.json({ question, conversationId, runId, ...result, durationMs });
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    logger.error({ err: error }, "Agent run failed");
    // Failed runs belong in the history too, so the list reflects reality.
    await recordRun({
      userId,
      question,
      conversationId,
      status: "failed",
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(502).json({ error: errors.agent.runFailed });
  }
});

const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

// History is browsed by conversation, newest activity first.
app.get("/agent/conversations", requireUser, requireVerified, async (req, res) => {
  const userId = req.user?.id;
  const query = pageQuery.safeParse(req.query);

  if (userId === undefined) {
    res.status(401).json({ error: errors.user.unauthorized });
    return;
  }

  if (!query.success) {
    res.status(400).json({ error: errors.user.badRequest });
    return;
  }

  try {
    const { limit, offset } = query.data;
    const [conversations, total] = await Promise.all([
      listConversations(userId, limit, offset),
      countConversations(userId),
    ]);

    res.json({ conversations, total, limit, offset });
  } catch (error) {
    logger.error({ err: error }, "Could not list conversations");
    res.status(500).json({ error: errors.user.internal });
  }
});

/*
 * Runs, optionally narrowed to one conversation. An empty conversationId selects
 * the runs made before conversation ids existed.
 */
app.get("/agent/runs", requireUser, requireVerified, async (req, res) => {
  const userId = req.user?.id;
  const query = pageQuery.safeParse(req.query);

  if (userId === undefined) {
    res.status(401).json({ error: errors.user.unauthorized });
    return;
  }

  if (!query.success) {
    res.status(400).json({ error: errors.user.badRequest });
    return;
  }

  const raw = req.query.conversationId;
  const conversationId =
    typeof raw === "string" ? (raw === "" ? null : raw) : undefined;

  try {
    const { limit, offset } = query.data;
    const [runs, total] = await Promise.all([
      listConversationRuns(userId, conversationId, limit, offset),
      countRuns(userId, conversationId),
    ]);

    res.json({ runs, total, limit, offset });
  } catch (error) {
    logger.error({ err: error }, "Could not list agent runs");
    res.status(500).json({ error: errors.user.internal });
  }
});

app.get("/agent/runs/:id", requireUser, requireVerified, async (req, res) => {
  const userId = req.user?.id;
  const id = Number(req.params.id);

  if (userId === undefined) {
    res.status(401).json({ error: errors.user.unauthorized });
    return;
  }

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: errors.user.badRequest });
    return;
  }

  try {
    const run = await getRun(userId, id);

    if (run === undefined) {
      res.status(404).json({ error: errors.user.notFound });
      return;
    }

    // stepsLog holds exactly what the model returned, so the detail view can show
    // the parsed output without re-running anything.
    let output: unknown = null;
    let sql: string[] = [];

    if (run.stepsLog !== null) {
      try {
        const parsed = JSON.parse(run.stepsLog) as {
          output?: unknown;
          sql?: string[];
        };
        output = parsed.output ?? null;
        sql = parsed.sql ?? [];
      } catch {
        logger.warn({ runId: run.id }, "Ignoring an unparseable steps log");
      }
    }

    res.json({
      run: {
        id: run.id,
        question: run.userPrompt,
        conversationId: run.conversationId,
        status: run.status,
        durationMs: run.durationMs,
        totalTokens: run.totalTokens,
        error: run.error,
        createdAt: run.createdAt,
        output,
        sql,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Could not load the agent run");
    res.status(500).json({ error: errors.user.internal });
  }
});

const reportBody = z.object({ runId: z.number().int().positive() });

/*
 * A report is made from a finished run: its answer, SQL and data are copied in,
 * then the PDF is rendered by the background worker.
 */
app.post("/reports", requireUser, requireVerified, async (req, res) => {
  const body = reportBody.safeParse(req.body);
  const userId = req.user?.id;

  if (!body.success) {
    res.status(400).json({ error: errors.user.badRequest });
    return;
  }

  if (userId === undefined) {
    res.status(401).json({ error: errors.user.unauthorized });
    return;
  }

  try {
    const run = await getRun(userId, body.data.runId);

    if (run === undefined) {
      res.status(404).json({ error: errors.user.notFound });
      return;
    }

    if (run.status !== "completed") {
      res.status(400).json({ error: errors.user.badRequest });
      return;
    }

    const { output, sql } = parseRunSteps(run.stepsLog);

    const report = await insertReport({
      userId,
      runId: run.id,
      title: output?.headline ?? run.userPrompt,
      question: run.userPrompt,
      generatedSql: sql.length === 0 ? null : [...new Set(sql)].join("\n\n"),
      resultSummary: output?.answer ?? null,
    });

    await inngest.send({
      name: "report/pdf.requested",
      data: { reportId: report.id },
    });

    res.status(201).json({
      report: { id: report.id, title: report.title, pdfStatus: report.pdfStatus },
    });
  } catch (error) {
    logger.error({ err: error }, "Could not create the report");
    res.status(500).json({ error: errors.user.internal });
  }
});

app.get("/reports", requireUser, requireVerified, async (req, res) => {
  const userId = req.user?.id;

  if (userId === undefined) {
    res.status(401).json({ error: errors.user.unauthorized });
    return;
  }

  try {
    res.json({ reports: await listReports(userId) });
  } catch (error) {
    logger.error({ err: error }, "Could not list reports");
    res.status(500).json({ error: errors.user.internal });
  }
});

app.get("/reports/:id/pdf", requireUser, requireVerified, async (req, res) => {
  const userId = req.user?.id;
  const id = Number(req.params.id);

  if (userId === undefined) {
    res.status(401).json({ error: errors.user.unauthorized });
    return;
  }

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: errors.user.badRequest });
    return;
  }

  try {
    const report = await getReport(userId, id);

    if (report === undefined) {
      res.status(404).json({ error: errors.user.notFound });
      return;
    }

    if (report.pdfStatus === "failed") {
      res.status(409).json({ error: errors.report.failed });
      return;
    }

    if (report.pdfStatus !== "ready" || report.pdfPath === null) {
      res.status(409).json({ error: errors.report.notReady });
      return;
    }

    res.sendFile(report.pdfPath);
  } catch (error) {
    logger.error({ err: error }, "Could not send the report PDF");
    res.status(500).json({ error: errors.user.internal });
  }
});

// Hands the question to the worker and returns immediately, so the caller is
// not held open for the length of a model call.
app.post("/agent/runs", requireUser, requireVerified, async (req, res) => {
  const body = askBody.safeParse(req.body);

  if (!body.success) {
    res.status(400).json({ error: errors.user.badRequest });
    return;
  }

  const userId = req.user?.id;

  if (userId === undefined) {
    res.status(401).json({ error: errors.user.unauthorized });
    return;
  }

  try {
    const sent = await inngest.send({
      name: "agent/run.requested",
      data: { question: body.data.question, userId },
    });

    res.status(202).json({ ids: sent.ids });
  } catch (error) {
    logger.error({ err: error }, "Could not enqueue the agent run");
    res.status(502).json({ error: errors.agent.runFailed });
  }
});

app.post("/auth/logout", requireUser, async (req, res) => {
  const token = bearerToken(req);

  if (token !== undefined) {
    const { error } = await supabase.auth.admin.signOut(token);

    if (error) {
      logger.warn({ err: error }, "Failed to revoke the session on logout");
    }
  }

  res.status(204).end();
});

// Client routes such as /login must survive a hard reload, so anything that is
// not an API path and not a real file falls through to the app shell.
app.use((req, res, next) => {
  const isApiPath =
    req.path.startsWith("/auth") ||
    req.path.startsWith("/api") ||
    req.path === "/health" ||
    req.path.includes(".");

  if (req.method !== "GET" || isApiPath) {
    next();
    return;
  }

  res.sendFile(join(webDir, "index.html"));
});

app.use((_req, res) => {
  res.status(404).json({ error: errors.user.notFound });
});

app.use((err: HttpError, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? err.statusCode ?? 500;

  if (status >= 500) {
    logger.error({ err }, "Unhandled request error");
    res.status(500).json({ error: errors.user.internal });
    return;
  }

  logger.warn({ err }, "Rejected request");
  res.status(status).json({ error: errors.user.badRequest });
});
