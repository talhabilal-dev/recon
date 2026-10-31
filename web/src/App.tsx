import { useState, type ReactNode } from "react"
import {
  ArrowRight,
  Menu,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  X,
} from "lucide-react"
import { Link } from "react-router"
import { Button } from "../components/ui/button"
import { cn } from "cn"
import { ReportSpecimen } from "./report-specimen.tsx"
import { ReportTeaser } from "./report-teaser.tsx"
import { useSession } from "./session.ts"
import { Wordmark } from "./wordmark.tsx"

const NAV = [
  { href: "#questions", label: "Questions" },
  { href: "#how", label: "How it works" },
  { href: "#guardrails", label: "Guardrails" },
  { href: "#stack", label: "Stack" },
]

const QUESTIONS = [
  "How many orders are completed?",
  "What's our profit and loss?",
  "What were total sales?",
  "Which product sells the most?",
]

const STEPS = [
  {
    title: "Reads the question",
    detail:
      "Plain language in. No SQL, no schema map, no metric definitions to hand it first.",
  },
  {
    title: "Plans the query",
    detail:
      "Picks the tables, filters on order status, and prices each sale from its snapshot cost.",
  },
  {
    title: "Runs it read-only",
    detail:
      "The connection cannot write to business tables, and destructive verbs are refused before they reach Postgres.",
  },
  {
    title: "Shows its work",
    detail:
      "The SQL, the steps and the numbers come back together, and the run can be saved as a report.",
  },
]

const STACK = [
  { name: "Express", role: "HTTP surface and token middleware" },
  { name: "Supabase", role: "Postgres for the books, Auth for people" },
  { name: "Drizzle", role: "Typed schema, relations and migrations" },
  { name: "LangGraph", role: "The loop that decides what to look at next" },
  { name: "OpenAI", role: "The model that writes the query" },
  { name: "TypeScript", role: "Strict, end to end" },
]

const STATS = [
  { value: "7", label: "business tables it reads" },
  { value: "2", label: "tables it may write" },
  { value: "1:1", label: "answers paired with SQL" },
  { value: "100%", label: "of runs recorded" },
]

const PERMISSIONS = [
  {
    title: "Business tables",
    detail: "orders · products · returns · expenses",
    verdict: "read only",
    allowed: true,
  },
  {
    title: "Report tables",
    detail: "reports · agent_runs",
    verdict: "writable",
    allowed: true,
  },
  {
    title: "Destructive statements",
    detail: "drop · delete · update · truncate · alter",
    verdict: "blocked",
    allowed: false,
  },
]

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[0.68rem] font-medium tracking-[0.18em] text-primary uppercase">
      {children}
    </p>
  )
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const session = useSession()

  return (
    <div id="top" className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Wordmark />

          <nav aria-label="Sections" className="ml-auto hidden items-center gap-0.5 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 md:ml-2">
            {session === null ? (
              <Link
                to="/login"
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Sign in
              </Link>
            ) : (
              <Button size="sm" className="h-8 px-3" render={<Link to="/dashboard" />}>
                Dashboard
              </Button>
            )}
            <Button
              size="sm"
              className="hidden h-8 px-3 md:inline-flex"
              render={<a href="#how" />}
            >
              See a run
              <ArrowRight />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="sr-only">Toggle navigation</span>
              {menuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>

        {menuOpen && (
          <div id="mobile-nav" className="border-t border-border/70 bg-background md:hidden">
            <nav
              aria-label="Sections"
              className="mx-auto flex w-full max-w-6xl flex-col px-3 py-3 sm:px-5"
            >
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between rounded-md px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                  <ArrowRight aria-hidden="true" className="size-4 opacity-40" />
                </a>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* Ink band: the statement and the one piece of evidence you see first. */}
        <section className="relative overflow-hidden bg-ink text-ink-foreground">
          <div
            aria-hidden="true"
            className="ledger-rules pointer-events-none absolute inset-0"
          />
          <div
            aria-hidden="true"
            className="hero-glow pointer-events-none absolute inset-0 opacity-80"
          />

          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-5 px-4 pt-6 pb-5 sm:gap-9 sm:px-6 sm:pt-14 sm:pb-16 lg:grid-cols-[1.02fr_1fr] lg:gap-14 lg:px-8 lg:pt-16 lg:pb-20">
            <div className="min-w-0">
              <p className="animate-rise inline-flex items-center gap-2 rounded-full border border-ink-foreground/15 bg-ink-foreground/5 px-3 py-1 font-mono text-[0.62rem] tracking-[0.16em] text-ink-foreground/75 uppercase">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-ink-accent opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-ink-accent" />
                </span>
                Read-only SQL agent
              </p>

              <h1 className="animate-rise mt-4 text-balance text-[clamp(2.15rem,7vw,4.1rem)] leading-[0.98] font-medium tracking-[-0.035em] [animation-delay:60ms] sm:mt-5">
                Ask your commerce data{" "}
                <span className="text-ink-accent">anything.</span>
                <span className="mt-2 block text-[0.6em] leading-[1.15] font-normal tracking-[-0.02em] text-ink-foreground/45 sm:mt-3">
                  It answers with the SQL that proves it.
                </span>
              </h1>

              <p className="animate-rise mt-3 max-w-[48ch] text-sm text-pretty leading-relaxed text-ink-foreground/65 [animation-delay:120ms] sm:mt-5 sm:text-base">
                Recon is an AI analyst for an e-commerce database. It reads your orders,
                products, returns and expenses, then hands back the number, the query it
                ran, and the report you keep.
              </p>

              <div className="animate-rise mt-5 flex flex-col items-start gap-2.5 sm:mt-7 sm:flex-row sm:items-center sm:gap-5 [animation-delay:160ms]">
                <Button
                  size="lg"
                  className="h-10 w-full px-4 text-[0.9rem] sm:w-auto"
                  render={<a href="#how" />}
                >
                  See a run
                  <ArrowRight />
                </Button>
                <a
                  href="#guardrails"
                  className="group inline-flex items-center gap-1.5 text-sm text-ink-foreground/60 underline decoration-ink-foreground/25 underline-offset-4 transition-colors hover:text-ink-foreground hover:decoration-ink-foreground/60"
                >
                  Read the guardrails
                  <ArrowRight
                    aria-hidden="true"
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                  />
                </a>
              </div>

              <p className="animate-rise mt-6 hidden flex-wrap items-center gap-x-2.5 gap-y-1.5 font-mono text-[0.62rem] tracking-[0.12em] text-ink-foreground/35 uppercase [animation-delay:200ms] sm:mt-8 sm:flex">
                <span>Express</span>
                <span aria-hidden="true">·</span>
                <span>Supabase</span>
                <span aria-hidden="true">·</span>
                <span>Drizzle</span>
                <span aria-hidden="true">·</span>
                <span>LangGraph</span>
                <span aria-hidden="true">·</span>
                <span>OpenAI</span>
              </p>
            </div>

            <div className="min-w-0">
              <ReportTeaser />
            </div>
          </div>
        </section>

        <section aria-label="At a glance" className="border-b border-border/70 bg-muted/30">
          <dl className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-6 gap-y-6 px-4 py-8 sm:grid-cols-4 sm:px-6 lg:px-8">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col-reverse sm:border-l sm:border-border/70 sm:pl-5 sm:first:border-l-0 sm:first:pl-0"
              >
                <dt className="mt-1 text-xs text-muted-foreground">{stat.label}</dt>
                <dd className="font-mono text-2xl font-medium tracking-tight tabular-nums sm:text-3xl">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          id="questions"
          className="scroll-mt-20 border-b border-border/70"
          aria-labelledby="questions-heading"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <SectionLabel>What it answers</SectionLabel>
                <h2
                  id="questions-heading"
                  className="mt-3 max-w-[22ch] text-balance text-3xl font-medium tracking-tight sm:text-4xl"
                >
                  The questions every store owner eventually asks.
                </h2>
              </div>
              <p className="max-w-[34ch] text-sm leading-relaxed text-muted-foreground sm:text-right">
                No dashboard to build, no metric layer to define. Ask in plain language and
                get the number back with its query.
              </p>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {QUESTIONS.map((question, index) => (
                <article
                  key={question}
                  className="group flex flex-col justify-between gap-8 rounded-xl border border-border/70 bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md hover:shadow-foreground/5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[0.65rem] text-muted-foreground tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Terminal
                      aria-hidden="true"
                      className="size-3.5 text-muted-foreground/70 transition-colors group-hover:text-primary"
                    />
                  </div>
                  <div>
                    <p className="text-base font-medium tracking-tight">{question}</p>
                    <p className="mt-3 font-mono text-[0.6rem] tracking-[0.12em] text-muted-foreground uppercase">
                      read-only query
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* The pipeline on one side, the actual artifact on the other. */}
        <section
          id="how"
          className="scroll-mt-20 border-b border-border/70 bg-muted/40"
          aria-labelledby="how-heading"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <SectionLabel>How it works</SectionLabel>
            <h2
              id="how-heading"
              className="mt-3 max-w-[22ch] text-balance text-3xl font-medium tracking-tight sm:text-4xl"
            >
              It investigates, then it tells you how.
            </h2>

            <div className="mt-10 grid items-start gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:gap-14">
              <ol className="relative">
                {STEPS.map((step, index) => (
                  <li
                    key={step.title}
                    className="relative grid grid-cols-[2rem_1fr] gap-4 pb-7 last:pb-0"
                  >
                    <div className="flex flex-col items-center">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 font-mono text-[0.7rem] font-medium text-primary tabular-nums">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {index < STEPS.length - 1 && (
                        <span
                          aria-hidden="true"
                          className="mt-1.5 w-px flex-1 bg-border"
                        />
                      )}
                    </div>
                    <div className="min-w-0 pt-1">
                      <h3 className="font-medium tracking-tight">{step.title}</h3>
                      <p className="mt-1.5 max-w-[42ch] text-sm leading-relaxed text-muted-foreground">
                        {step.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>

              <ReportSpecimen />
            </div>
          </div>
        </section>

        <section
          id="guardrails"
          className="scroll-mt-20 border-b border-border/70"
          aria-labelledby="guardrails-heading"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-8 lg:py-24">
            <div>
              <SectionLabel>Guardrails</SectionLabel>
              <h2
                id="guardrails-heading"
                className="mt-3 max-w-[18ch] text-balance text-3xl font-medium tracking-tight sm:text-4xl"
              >
                Read-only by construction.
              </h2>

              <ul className="mt-8 space-y-5">
                <li className="flex gap-3.5">
                  <ShieldCheck
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-primary"
                  />
                  <p className="max-w-[54ch] text-sm leading-relaxed text-muted-foreground">
                    The agent reads the business tables and nothing else. It never issues{" "}
                    <code className="font-mono text-[0.8rem] text-foreground">drop</code>,{" "}
                    <code className="font-mono text-[0.8rem] text-foreground">delete</code>,{" "}
                    <code className="font-mono text-[0.8rem] text-foreground">update</code>,{" "}
                    <code className="font-mono text-[0.8rem] text-foreground">truncate</code>{" "}
                    or <code className="font-mono text-[0.8rem] text-foreground">alter</code>.
                  </p>
                </li>
                <li className="flex gap-3.5">
                  <ShieldCheck
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-primary"
                  />
                  <p className="max-w-[54ch] text-sm leading-relaxed text-muted-foreground">
                    Writes are confined to the two tables it owns:{" "}
                    <code className="font-mono text-[0.8rem] text-foreground">reports</code>{" "}
                    and{" "}
                    <code className="font-mono text-[0.8rem] text-foreground">
                      agent_runs
                    </code>
                    .
                  </p>
                </li>
                <li className="flex gap-3.5">
                  <ShieldCheck
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-primary"
                  />
                  <p className="max-w-[54ch] text-sm leading-relaxed text-muted-foreground">
                    Every run is recorded, so you can always see what was asked and what came
                    back.
                  </p>
                </li>
              </ul>
            </div>

            <div className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
              <div className="flex items-center justify-between gap-4 border-b border-border/70 px-4 py-3">
                <span className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
                  Permission matrix
                </span>
                <span className="font-mono text-[0.58rem] tracking-[0.12em] text-muted-foreground uppercase">
                  enforced in code
                </span>
              </div>
              <ul className="divide-y divide-border/70">
                {PERMISSIONS.map((permission) => (
                  <li key={permission.title} className="flex items-start gap-3 px-4 py-4">
                    <span
                      className={cn(
                        "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
                        permission.allowed
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive"
                      )}
                    >
                      {permission.allowed ? (
                        <ShieldCheck aria-hidden="true" className="size-3.5" />
                      ) : (
                        <ShieldAlert aria-hidden="true" className="size-3.5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{permission.title}</p>
                      <p className="mt-0.5 max-w-[30ch] font-mono text-[0.68rem] leading-relaxed text-muted-foreground">
                        {permission.detail}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "ml-auto shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.56rem] tracking-[0.1em] uppercase",
                        permission.allowed
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive"
                      )}
                    >
                      {permission.verdict}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section
          id="stack"
          className="scroll-mt-20 border-b border-border/70 bg-muted/40"
          aria-labelledby="stack-heading"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <SectionLabel>Stack</SectionLabel>
            <h2
              id="stack-heading"
              className="mt-3 max-w-[24ch] text-balance text-3xl font-medium tracking-tight sm:text-4xl"
            >
              Small, typed, and boring on purpose.
            </h2>

            <dl className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {STACK.map((item, index) => (
                <div
                  key={item.name}
                  className="group rounded-xl border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <dt className="flex items-baseline justify-between gap-3 font-mono text-sm font-medium">
                    {item.name}
                    <span className="font-mono text-[0.6rem] text-muted-foreground tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {item.role}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="relative overflow-hidden bg-ink text-ink-foreground">
          <div
            aria-hidden="true"
            className="ledger-rules pointer-events-none absolute inset-0"
          />
          <div
            aria-hidden="true"
            className="hero-glow pointer-events-none absolute inset-0 opacity-70"
          />
          <div className="relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <p className="font-mono text-[0.68rem] font-medium tracking-[0.18em] text-ink-accent uppercase">
                Ready when your data is
              </p>
              <h2 className="mt-4 text-balance text-3xl font-medium tracking-tight sm:text-4xl lg:text-5xl">
                Point it at your books.
              </h2>
              <p className="mt-5 max-w-[52ch] leading-relaxed text-ink-foreground/70">
                Start with the four questions above, then keep pulling. Every answer arrives
                with its query attached, and the analysis dashboard is where you run them.
              </p>
              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
                <Button
                  size="lg"
                  className="h-10 w-full px-4 text-[0.9rem] sm:w-auto"
                  render={<a href="#questions" />}
                >
                  See the questions
                  <ArrowRight />
                </Button>
                <a
                  href="#guardrails"
                  className="group inline-flex items-center gap-1.5 text-sm text-ink-foreground/60 transition-colors hover:text-ink-foreground"
                >
                  Read the guardrails
                  <ArrowRight
                    aria-hidden="true"
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                  />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex flex-col gap-2">
            <Wordmark />
            <p className="text-xs text-muted-foreground">
              A showcase project. The figures and queries shown are illustrative.
            </p>
          </div>
          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground"
          >
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}
