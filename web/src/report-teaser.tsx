import { Clock, Database } from "lucide-react"

/*
 * The compact proof object. Sits in the first viewport, so it is deliberately
 * short: the question, the number, the breakdown, and one line of provenance.
 * The full run (steps, generated SQL, result rows) lives in the section below.
 *
 * A fixed paper surface on purpose: it reads as a document in both themes,
 * while the hero behind it stays ink.
 */
const GROSS = 486300
const REFUNDS = 38480
const EXPENSES = 232940
const NET = GROSS - REFUNDS - EXPENSES
const COMPLETED_ORDERS = 1942

const MONEY = new Intl.NumberFormat("en-US")

const SEGMENTS = [
  { label: "net", value: NET, tone: "bg-paper-primary" },
  { label: "refunds", value: REFUNDS, tone: "bg-paper-destructive/45" },
  { label: "costs", value: EXPENSES, tone: "bg-paper-destructive/75" },
]

const BREAKDOWN = [
  { label: "gross", value: GROSS },
  { label: "refunds", value: REFUNDS },
  { label: "costs", value: EXPENSES },
]

export function ReportTeaser() {
  return (
    <section
      aria-label="Example run"
      className="animate-rise relative w-full overflow-hidden rounded-2xl bg-paper text-paper-foreground shadow-2xl shadow-ink/40 ring-1 ring-ink-foreground/10 [animation-delay:180ms]"
    >
      <header className="flex items-center gap-2.5 px-4 py-2.5 sm:px-5 sm:py-3">
        <span aria-hidden="true" className="flex shrink-0 items-center gap-1.5">
          <span className="size-2 rounded-full bg-paper-destructive/45" />
          <span className="size-2 rounded-full bg-paper-foreground/15" />
          <span className="size-2 rounded-full bg-paper-primary" />
        </span>
        <span className="truncate font-mono text-[0.65rem] tracking-[0.14em] whitespace-nowrap text-paper-muted uppercase">
          recon / run 0412
        </span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-paper-primary/10 px-2 py-0.5 font-mono text-[0.6rem] tracking-[0.12em] whitespace-nowrap text-paper-primary uppercase">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-paper-primary" />
          read-only
        </span>
      </header>

      <div aria-hidden="true" className="h-px bg-paper-border" />

      <div className="px-4 py-3 sm:px-5 sm:py-4">
        <p className="font-mono text-[0.65rem] tracking-[0.14em] text-paper-muted uppercase">
          Asked
        </p>
        <p className="mt-1.5 text-base font-medium tracking-tight sm:text-lg">
          What's our profit and loss?
        </p>
      </div>

      <div aria-hidden="true" className="h-px bg-paper-border" />

      <div className="px-4 py-3.5 sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
          <div>
            <p className="font-mono text-3xl leading-none font-medium tracking-tight tabular-nums sm:text-4xl">
              €{MONEY.format(NET)}
            </p>
            <p className="mt-1.5 text-xs text-paper-muted">
              net profit on {MONEY.format(COMPLETED_ORDERS)} completed orders
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-paper-primary/10 px-2 py-0.5 font-mono text-[0.65rem] font-medium text-paper-primary tabular-nums">
            +12.4%
          </span>
        </div>

        <div className="mt-4 sm:mt-5">
          <div
            aria-hidden="true"
            className="flex h-2.5 w-full overflow-hidden rounded-full bg-paper-border"
          >
            {SEGMENTS.map((segment) => (
              <div
                key={segment.label}
                className={segment.tone}
                style={{ width: `${(segment.value / GROSS) * 100}%` }}
              />
            ))}
          </div>

          <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.65rem] text-paper-muted">
            {SEGMENTS.map((segment) => (
              <li key={segment.label} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`size-1.5 shrink-0 rounded-[2px] ${segment.tone}`}
                />
                {segment.label} {MONEY.format(segment.value)}
              </li>
            ))}
          </ul>
        </div>

        <dl className="mt-4 hidden grid-cols-3 overflow-hidden rounded-lg border border-paper-border sm:grid">
          {BREAKDOWN.map((item) => (
            <div
              key={item.label}
              className="border-r border-paper-border px-2.5 py-2 last:border-r-0"
            >
              <dt className="font-mono text-[0.55rem] tracking-[0.12em] text-paper-muted uppercase">
                {item.label}
              </dt>
              <dd className="mt-0.5 font-mono text-xs font-medium tabular-nums sm:text-sm">
                €{MONEY.format(item.value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div aria-hidden="true" className="h-px bg-paper-border" />

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 font-mono text-[0.65rem] text-paper-muted sm:px-5 sm:py-2.5">
        <span className="inline-flex items-center gap-1.5">
          <Database aria-hidden="true" className="size-3.5" />4 tables
        </span>
        <span aria-hidden="true">·</span>
        <span>1 query</span>
        <span className="ml-auto inline-flex items-center gap-1.5">
          <Clock aria-hidden="true" className="size-3.5" />68 ms
        </span>
      </footer>
    </section>
  )
}
