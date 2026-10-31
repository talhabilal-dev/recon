import { Inngest, NonRetriableError } from "inngest";
import { z } from "zod";
import { askAgent, recordRun } from "./agent.ts";
import { env } from "./config/env.ts";
import { logger } from "./logger.ts";
import {
  getReportWithRun,
  markReportFailed,
  markReportReady,
  renderPdf,
  reportHtml,
  writePdf,
} from "./reports.ts";

/*
 * Inngest's logger interface is pino-shaped, so the SDK's own errors and
 * warnings land in our logs instead of disappearing.
 *
 * `isDev` is derived from NODE_ENV rather than left to INNGEST_DEV: without it
 * the SDK assumes cloud mode, demands a signing key, and answers every request
 * to /api/inngest with a bare 500.
 */
export const inngest = new Inngest({
  id: "recon",
  isDev: env.NODE_ENV !== "production",
  logger,
});

// The event payload crosses a process boundary, so it is validated rather than
// trusted. A malformed payload should not burn the retry budget.
const runRequested = z.object({
  question: z.string().min(1).max(2000),
  userId: z.uuid(),
});

/*
 * An agent run is slow, network-bound work. Running it here instead of inside
 * the request that asked for it keeps the HTTP response instant and gives the
 * call retries and a durable step log.
 */
export const runAgent = inngest.createFunction(
  {
    id: "run-agent",
    retries: 2,
    triggers: [{ event: "agent/run.requested" }],
    // Runs once, after the retries are exhausted, so a failure lands in the
    // history exactly once rather than once per attempt.
    onFailure: async ({ event, error }) => {
      const parsed = runRequested.safeParse(event.data);

      if (!parsed.success) return;

      await recordRun({
        userId: parsed.data.userId,
        question: parsed.data.question,
        conversationId: parsed.data.userId,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    },
  },
  async ({ event, step }) => {
    const parsed = runRequested.safeParse(event.data);

    if (!parsed.success) {
      throw new NonRetriableError("agent/run.requested needs a question and userId");
    }

    const { question, userId } = parsed.data;
    const startedAt = Date.now();

    // step.run memoises the call, so a retry resumes rather than re-running it.
    const result = await step.run("ask-the-model", async () => {
      logger.info({ question }, "Agent run started");
      return askAgent(question, userId);
    });

    const durationMs = Date.now() - startedAt;

    await recordRun({
      userId,
      question,
      conversationId: userId,
      status: "completed",
      durationMs,
      ...result,
    });

    logger.info({ question, durationMs }, "Agent run finished");

    return { question, ...result, durationMs };
  },
);

const reportRequested = z.object({
  reportId: z.number().int().positive(),
});

/*
 * Report PDFs are slow, browser-bound work, so they run here rather than inside
 * the request that asked for them. Puppeteer prints an HTML document we build
 * from the stored run, then the file lands on disk and the row is updated.
 */
export const buildReportPdf = inngest.createFunction(
  {
    id: "build-report-pdf",
    retries: 2,
    triggers: [{ event: "report/pdf.requested" }],
    onFailure: async ({ event, error }) => {
      const parsed = reportRequested.safeParse(event.data);

      if (!parsed.success) return;

      await markReportFailed(
        parsed.data.reportId,
        error instanceof Error ? error.message : String(error),
      );
    },
  },
  async ({ event, step }) => {
    const parsed = reportRequested.safeParse(event.data);

    if (!parsed.success) {
      throw new NonRetriableError("report/pdf.requested needs a reportId");
    }

    const { reportId } = parsed.data;

    const pdfPath = await step.run("render-pdf", async () => {
      const found = await getReportWithRun(reportId);

      if (found === null) {
        throw new NonRetriableError(`report ${reportId} does not exist`);
      }

      const html = reportHtml({
        title: found.report.title,
        question: found.report.question,
        output: found.output,
        sql: found.sql,
        createdAt: found.report.createdAt,
      });

      return writePdf(reportId, await renderPdf(html));
    });

    await step.run("mark-ready", async () => markReportReady(reportId, pdfPath));

    logger.info({ reportId, pdfPath }, "Report PDF ready");

    return { reportId, pdfPath };
  },
);
