import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and, desc, eq } from "drizzle-orm";
import puppeteer from "puppeteer-core";
import type { AgentOutput } from "./agent.ts";
import { getDb } from "./db/index.ts";
import { agentRuns, reports } from "./db/schema.ts";

/*
 * Chrome is already on the host, so puppeteer-core drives that binary instead of
 * downloading a second copy of the browser.
 */
const CHROME_PATH = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const REPORTS_DIR = join(import.meta.dirname, "..", "storage", "reports");

export type ReportRow = typeof reports.$inferSelect;

export function parseRunSteps(stepsLog: string | null): {
  output: AgentOutput | null;
  sql: string[];
} {
  if (stepsLog === null) return { output: null, sql: [] };

  try {
    const parsed = JSON.parse(stepsLog) as { output?: AgentOutput; sql?: string[] };
    return { output: parsed.output ?? null, sql: parsed.sql ?? [] };
  } catch {
    return { output: null, sql: [] };
  }
}

export async function insertReport(report: {
  userId: string;
  runId: number;
  title: string;
  question: string;
  generatedSql: string | null;
  resultSummary: string | null;
}): Promise<ReportRow> {
  const [row] = await getDb().insert(reports).values(report).returning();
  return row as ReportRow;
}

export async function listReports(userId: string) {
  return getDb()
    .select({
      id: reports.id,
      title: reports.title,
      question: reports.question,
      pdfStatus: reports.pdfStatus,
      pdfError: reports.pdfError,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.userId, userId))
    .orderBy(desc(reports.createdAt))
    .limit(25);
}

export async function getReport(userId: string, id: number) {
  const [row] = await getDb()
    .select()
    .from(reports)
    .where(and(eq(reports.userId, userId), eq(reports.id, id)))
    .limit(1);

  return row;
}

// The worker has no session, so it looks the report up by id alone.
export async function getReportWithRun(reportId: number) {
  const [row] = await getDb()
    .select()
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);

  if (row === undefined) return null;

  let output: AgentOutput | null = null;
  let sql: string[] = [];

  if (row.runId !== null) {
    const [run] = await getDb()
      .select({ stepsLog: agentRuns.stepsLog })
      .from(agentRuns)
      .where(eq(agentRuns.id, row.runId))
      .limit(1);

    ({ output, sql } = parseRunSteps(run?.stepsLog ?? null));
  }

  return { report: row, output, sql };
}

export async function markReportReady(id: number, pdfPath: string): Promise<void> {
  await getDb()
    .update(reports)
    .set({ pdfStatus: "ready", pdfPath, pdfError: null })
    .where(eq(reports.id, id));
}

export async function markReportFailed(id: number, error: string): Promise<void> {
  await getDb()
    .update(reports)
    .set({ pdfStatus: "failed", pdfError: error })
    .where(eq(reports.id, id));
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}

// The answer is a sentence or two; the PDF shows it as prose, not markdown.
function plainText(value: string): string {
  return escapeHtml(value.replace(/\*\*(.*?)\*\*/g, "$1").replace(/`([^`]*)`/g, "$1"));
}

function dataTable(output: AgentOutput | null): string {
  if (output?.table == null || output.table.rows.length === 0) return "";

  const head = output.table.columns
    .map((column) => `<th>${escapeHtml(column)}</th>`)
    .join("");
  const body = output.table.rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
    )
    .join("");

  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function metricsList(output: AgentOutput | null): string {
  const metrics = output?.metrics ?? [];
  if (metrics.length === 0) return "";

  return `<ul class="metrics">${metrics
    .map(
      (metric) =>
        `<li><strong>${escapeHtml(metric.value)}</strong><span>${escapeHtml(metric.label)}</span></li>`,
    )
    .join("")}</ul>`;
}

export function reportHtml(input: {
  title: string;
  question: string | null;
  output: AgentOutput | null;
  sql: string[];
  createdAt: Date;
}): string {
  const statements = [...new Set(input.sql)]
    .map((statement) => `<pre>${escapeHtml(statement)}</pre>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(input.title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Helvetica Neue", Arial, sans-serif;
    color: #1c2320;
    font-size: 11pt;
    line-height: 1.55;
    margin: 0;
  }
  header { border-bottom: 2px solid #16724f; padding-bottom: 10px; margin-bottom: 22px; }
  .brand { font-size: 8pt; letter-spacing: 0.18em; text-transform: uppercase; color: #16724f; }
  h1 { font-size: 20pt; margin: 6px 0 4px; letter-spacing: -0.01em; }
  .meta { font-size: 8.5pt; color: #5f6b64; }
  h2 { font-size: 9pt; letter-spacing: 0.14em; text-transform: uppercase; color: #5f6b64; margin: 26px 0 8px; }
  .metrics { display: flex; flex-wrap: wrap; gap: 10px; list-style: none; padding: 0; margin: 0; }
  .metrics li { border: 1px solid #d8ddd9; border-radius: 6px; padding: 8px 12px; min-width: 110px; }
  .metrics strong { display: block; font-size: 13pt; }
  .metrics span { font-size: 8.5pt; color: #5f6b64; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th, td { border-bottom: 1px solid #e2e6e3; padding: 6px 8px; text-align: left; }
  th { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.08em; color: #5f6b64; }
  pre {
    background: #f3f5f4;
    border-radius: 6px;
    padding: 10px;
    font-family: "DejaVu Sans Mono", monospace;
    font-size: 8pt;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0 0 8px;
  }
  footer { margin-top: 28px; border-top: 1px solid #e2e6e3; padding-top: 8px; font-size: 8pt; color: #5f6b64; }
</style>
</head>
<body>
  <header>
    <p class="brand">Recon · commerce analyst</p>
    <h1>${escapeHtml(input.title)}</h1>
    <p class="meta">${escapeHtml(input.question ?? "")} · ${input.createdAt.toISOString().slice(0, 10)}</p>
  </header>

  ${input.output === null ? "" : `<p>${plainText(input.output.answer)}</p>`}
  ${metricsList(input.output)}

  ${dataTable(input.output) === "" ? "" : `<h2>Data</h2>${dataTable(input.output)}`}
  ${statements === "" ? "" : `<h2>SQL</h2>${statements}`}

  <footer>Generated by Recon from a read-only query. Figures reflect the database at the time of the run.</footer>
</body>
</html>`;
}

export async function renderPdf(html: string): Promise<Uint8Array> {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    return await page.pdf({ format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }
}

export async function writePdf(id: number, bytes: Uint8Array): Promise<string> {
  await mkdir(REPORTS_DIR, { recursive: true });
  const path = join(REPORTS_DIR, `${id}.pdf`);
  await writeFile(path, bytes);
  return path;
}
