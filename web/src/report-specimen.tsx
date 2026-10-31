import { cn } from "cn"
import { Separator } from "../components/ui/separator"

/*
 * A frozen example of one finished run, shown as product evidence. It is inert
 * on purpose: the landing page explains the agent, the dashboard runs it.
 */
const RUN = {
  question: "What's our profit and loss?",
  value: "€214,880",
  label: "net profit",
  note: "Gross profit €486,300, less €38,480 refunded and €232,940 in running costs.",
  sql: `with gross as (
  select sum(oi.quantity * (oi.unit_price - oi.unit_cost)) as profit
  from order_items oi
  join orders o on o.id = oi.order_id
  where o.status = 'completed'
), deductions as (
  select
    (select coalesce(sum(refund_amount), 0) from returns) as refunds,
    (select coalesce(sum(amount), 0) from expenses) as expenses
)
select
  gross.profit        as gross_profit,
  deductions.refunds  as refunds,
  deductions.expenses as expenses,
  gross.profit - deductions.refunds - deductions.expenses as net_profit
from gross, deductions;`,
  columns: ["gross_profit", "refunds", "expenses", "net_profit"],
  rows: [[486300, 38480, 232940, 214880]],
}

const KEYWORDS = new Set([
  "as",
  "by",
  "coalesce",
  "from",
  "join",
  "on",
  "select",
  "sum",
  "where",
  "with",
])

function Sql({ source }: { source: string }) {
  const tokens = source.split(/(\s+|[(),;]|'[^']*')/)

  return (
    <pre
      role="region"
      aria-labelledby="specimen-sql-heading"
      tabIndex={0}
      className="overflow-x-auto p-3 font-mono text-[0.68rem] leading-relaxed text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-4 sm:text-[0.78rem]"
    >
      <code>
        {tokens.map((token, index) => {
          if (token === "") return null

          if (token.startsWith("'")) {
            return (
              <span key={index} className="text-primary">
                {token}
              </span>
            )
          }

          if (KEYWORDS.has(token.toLowerCase())) {
            return (
              <span key={index} className="font-medium text-foreground">
                {token}
              </span>
            )
          }

          if (/^\d/.test(token)) {
            return (
              <span key={index} className="text-foreground/70">
                {token}
              </span>
            )
          }

          return <span key={index}>{token}</span>
        })}
      </code>
    </pre>
  )
}

export function ReportSpecimen() {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
        <span className="font-mono text-[0.7rem] tracking-wide text-muted-foreground uppercase">
          Example run
        </span>
        <Separator orientation="vertical" className="h-4" />
        <span className="font-mono text-[0.7rem] text-muted-foreground">
          saved as a report
        </span>
      </header>

      <Separator />

      <div className="px-4 py-4">
        <p className="font-mono text-[0.7rem] tracking-wide text-muted-foreground uppercase">
          Asked
        </p>
        <p className="mt-2 text-lg font-medium tracking-tight">{RUN.question}</p>
      </div>

      <Separator />

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 pt-4">
        <p className="font-mono text-2xl leading-none font-medium tracking-tight tabular-nums sm:text-3xl">
          {RUN.value}
        </p>
        <p className="text-sm text-muted-foreground">{RUN.label}</p>
      </div>
      <p className="px-4 pt-2 pb-4 text-sm text-muted-foreground">{RUN.note}</p>

      <Separator />

      <div>
        <h3
          id="specimen-sql-heading"
          className="px-4 pt-3 font-mono text-[0.7rem] tracking-wide text-muted-foreground uppercase"
        >
          Generated SQL
        </h3>
        <Sql source={RUN.sql} />
      </div>

      <Separator />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[26rem] border-collapse text-left font-mono text-[0.72rem] sm:text-[0.78rem]">
          <caption className="sr-only">Rows returned by the query above</caption>
          <thead>
            <tr className="border-b">
              {RUN.columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="px-4 py-2 font-medium text-muted-foreground"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RUN.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border/60 last:border-b-0">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={cn(
                      "px-4 py-2 tabular-nums text-foreground",
                      cellIndex === row.length - 1 && "text-right font-medium text-primary"
                    )}
                  >
                    {typeof cell === "number" ? cell.toLocaleString("en-US") : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
