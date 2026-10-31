import { isAIMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { createAgent, tool } from "langchain";
import { z } from "zod";
import { env } from "./config/env.ts";
import { getClient, getDb } from "./db/index.ts";
import {
  agentRuns,
  categories,
  customers,
  expenses,
  orderItems,
  orders,
  products,
  reports,
  returns,
} from "./db/schema.ts";
import { logger } from "./logger.ts";

const MAX_ROWS = 100;

// What the agent is allowed to see. Listed explicitly so adding a table to the
// schema is a deliberate choice, not a side effect.
const TABLES = [
  customers,
  categories,
  products,
  orders,
  orderItems,
  returns,
  expenses,
  reports,
  agentRuns,
];

const SYSTEM_PROMPT = `You are Recon, an analyst for an e-commerce database.

Tools
- read_schema: lists every table and column. Call it before writing SQL, and never guess a column name.
- run_query: runs one read-only SQL statement and returns the rows.

Rules that bind every answer
- The connection is read-only. Never attempt drop, delete, update, truncate or alter.
- orders.status is one of pending, completed, cancelled, returned.
- Price a sale from the snapshot columns on order_items (unit_price, unit_cost). Never recompute history from a product's current price.
- Gross profit is sum(quantity * (unit_price - unit_cost)) over completed orders.
- Net profit is gross profit, less refunds from returns, less running expenses for the same period.
- The interface shows the SQL you ran beneath your answer, so never paste the SQL into your answer.
- Answer in markdown: lead with the number, and keep the prose to a sentence or two.
- Put every row of data in table. Never repeat it as a markdown table in your answer: the interface renders that table and charts it.
- Round money to two decimals.
- If a query fails or returns nothing, say so plainly. Never invent a figure.`;

function describeSchema(): string {
  return TABLES.map((table) => {
    const { name, columns } = getTableConfig(table);
    const described = columns
      .map(
        (column) =>
          `${column.name} ${column.columnType}${column.notNull ? " not null" : ""}`,
      )
      .join(", ");

    return `${name}(${described})`;
  }).join("\n");
}

export const readSchema = tool(
  async () => describeSchema(),
  {
    name: "read_schema",
    description:
      "List every table and column in the e-commerce database. Call this before writing SQL.",
    schema: z.object({}),
  },
);

const READ_ONLY_PREFIX = /^\s*(select|with)\b/i;

export const runQuery = tool(
  async ({ sql }) => {
    if (!READ_ONLY_PREFIX.test(sql)) {
      return "Rejected: only select and with statements are allowed.";
    }

    try {
      // The prefix check is not enough: a data-modifying CTE starts with "with".
      // The read-only transaction makes Postgres itself refuse any write.
      const rows = await getClient().begin(async (tx) => {
        await tx.unsafe("set transaction read only");
        await tx.unsafe("set local statement_timeout = '10s'");
        return tx.unsafe(sql);
      });

      const limited = rows.slice(0, MAX_ROWS);
      const note =
        rows.length > MAX_ROWS
          ? `\n(truncated: showing ${MAX_ROWS} of ${rows.length} rows)`
          : "";

      return JSON.stringify(limited) + note;
    } catch (error) {
      // Returned rather than thrown so the model can correct its own SQL.
      return `Query failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "run_query",
    description: "Run a single read-only SQL statement and return the rows as JSON.",
    schema: z.object({
      sql: z.string().describe("One select or with statement"),
    }),
  },
);

/*
 * The shape the model must return. It is enforced twice: once by the agent's own
 * responseFormat, then again here, so a malformed answer fails the run loudly
 * instead of reaching the interface half-formed.
 *
 * Every field is required and non-nullable. OpenAI's strict structured outputs
 * reject a schema whose `required` omits any key in `properties` (the first
 * version of this used .nullish() and the API answered "Missing 'metrics'"), so
 * "nothing to show" is expressed as an empty array instead of null.
 */
export const answerFormat = z.object({
  headline: z
    .string()
    .describe("One short line naming the metric, for example 'Total sales this month'"),
  answer: z
    .string()
    .describe("Two or three sentences of markdown explaining the finding"),
  metrics: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .describe("The headline numbers, formatted for display. Empty array when there are none."),
  /*
   * The only place data belongs. The interface decides how to visualise it, so
   * the model never names a chart type or pre-computes chart points.
   */
  table: z
    .object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())) })
    .describe(
      "The result set to display. Use empty columns and rows when the answer is not tabular.",
    ),
  tablesRead: z.array(z.string()).describe("The tables the SQL read."),
});

export type AgentOutput = z.infer<typeof answerFormat>;

const agent = createAgent({
  model: env.OPENAI_MODEL,
  systemPrompt: SYSTEM_PROMPT,
  tools: [readSchema, runQuery],
  responseFormat: answerFormat,
});

export type AgentAnswer = {
  output: AgentOutput;
  sql: string[];
  totalTokens: number;
};

/*
 * Conversation memory. The agent itself is stateless, so a session is a bounded
 * transcript keyed by a conversation id supplied by the client. Only the user
 * question and the final answer are kept: replaying prior tool calls would grow
 * the prompt on every turn and risk pairing a tool result with a missing call.
 */
const conversations = new Map<string, BaseMessage[]>();
const MAX_TURNS = 3;

export function clearConversation(conversationId: string): void {
  conversations.delete(conversationId);
}

export async function askAgent(
  question: string,
  conversationId: string,
): Promise<AgentAnswer> {
  const history = conversations.get(conversationId) ?? [];

  const result = await agent.invoke({
    messages: [...history, { role: "user", content: question }],
  });

  // Only this turn's messages, so tokens and SQL describe this answer alone.
  const turn = result.messages.slice(history.length);

  // parse() re-validates at our boundary and throws on a bad shape, which the
  // caller records as a failed run.
  const output = answerFormat.parse(result.structuredResponse);

  // "Show the work": every statement the model actually ran this turn.
  const sql = turn.flatMap((message) => {
    if (!isAIMessage(message)) return [];

    return (message.tool_calls ?? [])
      .filter((call) => call.name === "run_query")
      .map((call) => String((call.args as { sql?: unknown }).sql ?? ""));
  });

  // Tokens across this turn's model calls, including the tool round trips.
  const totalTokens = turn.reduce((sum, message) => {
    if (!isAIMessage(message)) return sum;
    return sum + (message.usage_metadata?.total_tokens ?? 0);
  }, 0);

  conversations.set(
    conversationId,
    [
      ...history,
      { role: "user", content: question },
      { role: "assistant", content: output.answer },
    ].slice(-MAX_TURNS * 2) as BaseMessage[],
  );

  return { output, sql, totalTokens };
}

export type RunOutcome = {
  userId: string;
  question: string;
  conversationId?: string;
  status: "completed" | "failed";
  durationMs?: number;
  totalTokens?: number;
  output?: AgentOutput;
  sql?: string[];
  error?: string;
};

/*
 * Recording never fails the request it describes: the answer already exists, and
 * the database is the least reliable part of the path. Returns the new run id so
 * the caller can offer to save it as a report.
 */
export async function recordRun(run: RunOutcome): Promise<number | null> {
  try {
    const [row] = await getDb()
      .insert(agentRuns)
      .values({
        userId: run.userId,
        conversationId: run.conversationId ?? null,
        userPrompt: run.question,
        status: run.status,
        durationMs: run.durationMs ?? null,
        totalTokens: run.totalTokens ?? null,
        error: run.error ?? null,
        stepsLog:
          run.status === "completed"
            ? JSON.stringify({ output: run.output ?? null, sql: run.sql ?? [] })
            : null,
      })
      .returning({ id: agentRuns.id });

    return row?.id ?? null;
  } catch (error) {
    logger.warn({ err: error }, "Could not record the agent run");
    return null;
  }
}

export async function getRun(userId: string, id: number) {
  const [run] = await getDb()
    .select()
    .from(agentRuns)
    .where(and(eq(agentRuns.userId, userId), eq(agentRuns.id, id)))
    .limit(1);

  return run;
}

export type ConversationSummary = {
  conversationId: string | null;
  runs: number;
  totalTokens: number;
  lastAt: string;
  lastQuestion: string;
  lastStatus: string;
};

type ConversationRow = {
  conversation_id: string | null;
  runs: number;
  tokens: number;
  last_at: string;
  last_question: string;
  last_status: string;
};

/*
 * Runs grouped by conversation, newest activity first. The row shape is asserted
 * because drizzle's execute() is untyped; the select list above is the contract.
 * Runs made before conversation ids existed group under a null id.
 */
export async function listConversations(
  userId: string,
  limit: number,
  offset: number,
): Promise<ConversationSummary[]> {
  const rows = await getDb().execute(sql`
    select
      conversation_id,
      count(*)::int as runs,
      coalesce(sum(total_tokens), 0)::int as tokens,
      max(created_at)::text as last_at,
      (array_agg(user_prompt order by created_at desc))[1] as last_question,
      (array_agg(status order by created_at desc))[1] as last_status
    from agent_runs
    where user_id = ${userId}
    group by conversation_id
    order by max(created_at) desc
    limit ${limit} offset ${offset}
  `);

  return (rows as unknown as ConversationRow[]).map((row) => ({
    conversationId: row.conversation_id,
    runs: row.runs,
    totalTokens: row.tokens,
    lastAt: row.last_at,
    lastQuestion: row.last_question,
    lastStatus: row.last_status,
  }));
}

export async function countConversations(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({
      total: sql<number>`count(distinct coalesce(${agentRuns.conversationId}, ''))::int`,
    })
    .from(agentRuns)
    .where(eq(agentRuns.userId, userId));

  return row?.total ?? 0;
}

export function conversationFilter(
  userId: string,
  conversationId?: string | null,
) {
  const owner = eq(agentRuns.userId, userId);

  if (conversationId === undefined) return owner;

  return conversationId === null
    ? and(owner, isNull(agentRuns.conversationId))
    : and(owner, eq(agentRuns.conversationId, conversationId));
}

export async function listConversationRuns(
  userId: string,
  conversationId: string | null | undefined,
  limit: number,
  offset: number,
) {
  return getDb()
    .select({
      id: agentRuns.id,
      conversationId: agentRuns.conversationId,
      question: agentRuns.userPrompt,
      status: agentRuns.status,
      durationMs: agentRuns.durationMs,
      totalTokens: agentRuns.totalTokens,
      error: agentRuns.error,
      createdAt: agentRuns.createdAt,
    })
    .from(agentRuns)
    .where(conversationFilter(userId, conversationId))
    .orderBy(desc(agentRuns.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countRuns(
  userId: string,
  conversationId: string | null | undefined,
) {
  const [row] = await getDb()
    .select({ total: sql<number>`count(*)::int` })
    .from(agentRuns)
    .where(conversationFilter(userId, conversationId));

  return row?.total ?? 0;
}
