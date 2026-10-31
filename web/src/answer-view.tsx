import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Chart } from "./chart.tsx"

export type AgentOutput = {
  headline: string
  answer: string
  metrics?: { label: string; value: string }[] | null
  table?: { columns: string[]; rows: string[][] } | null
  tablesRead?: string[] | null
}

/*
 * One renderer for a validated agent answer, shared by the composer result and
 * the run detail view so the two can never drift apart.
 */
export function AnswerView({ output, sql }: { output: AgentOutput; sql: string[] }) {
  const metrics = output.metrics ?? []
  const tablesRead = output.tablesRead ?? []
  const statements = [...new Set(sql)]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
          {output.headline}
        </p>
        <div className="md-body mt-1.5">
          <Markdown remarkPlugins={[remarkGfm]}>{output.answer}</Markdown>
        </div>
      </div>

      {metrics.length > 0 && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2"
            >
              <dd className="font-mono text-lg font-medium tracking-tight tabular-nums">
                {metric.value}
              </dd>
              <dt className="mt-0.5 text-[0.7rem] text-muted-foreground">{metric.label}</dt>
            </div>
          ))}
        </dl>
      )}

      {/* The chart is derived from the returned table, never chosen by the model. */}
      {output.table != null && <Chart table={output.table} />}

      {output.table != null && output.table.rows.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border/70">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Query result</caption>
            <thead>
              <tr className="border-b border-border/70 bg-muted/40">
                {output.table.columns.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="px-3 py-2 font-medium text-muted-foreground"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {output.table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border/60 last:border-b-0">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 font-mono text-xs">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tablesRead.length > 0 && (
        <p className="font-mono text-[0.65rem] text-muted-foreground">
          tables read: {tablesRead.join(", ")}
        </p>
      )}

      {statements.length > 0 && (
        <details open className="group">
          <summary className="cursor-pointer font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
            SQL
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {statements.map((statement) => (
              <li key={statement}>
                <pre className="rounded-lg bg-muted p-3 font-mono text-[0.75rem] leading-relaxed whitespace-pre-wrap break-words">
                  <code>{statement}</code>
                </pre>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
