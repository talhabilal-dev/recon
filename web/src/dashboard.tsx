import { useCallback, useEffect, useState, type FormEvent } from "react"
import { FileText, History, LogOut, ShieldCheck, Sparkles } from "lucide-react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { AnswerView, type AgentOutput } from "./answer-view.tsx"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Separator } from "../components/ui/separator"
import { Skeleton } from "../components/ui/skeleton"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "../components/ui/sidebar"
import { setSession, useSession } from "./session.ts"
import { Wordmark } from "./wordmark.tsx"

const VIEWS = [
  { id: "ask", label: "Ask a question", icon: Sparkles },
  { id: "runs", label: "Conversations", icon: History },
  { id: "reports", label: "Saved reports", icon: FileText },
] as const

type Run = {
  id: number
  conversationId: string | null
  question: string
  status: string
  durationMs: number | null
  totalTokens: number | null
  error: string | null
  createdAt: string
}

type Answer = {
  question: string
  conversationId: string
  runId: number | null
  output: AgentOutput
  sql: string[]
  totalTokens: number
  durationMs: number
}

type Report = {
  id: number
  title: string
  question: string | null
  pdfStatus: string
  pdfError: string | null
  createdAt: string
}

const CONVERSATION_KEY = "recon.conversation"

function readConversationId(): string {
  try {
    const existing = window.localStorage.getItem(CONVERSATION_KEY)
    if (existing !== null && existing !== "") return existing
  } catch {
    // Storage blocked; fall through to a fresh id.
  }

  return startConversationId()
}

function startConversationId(): string {
  const fresh = crypto.randomUUID()

  try {
    window.localStorage.setItem(CONVERSATION_KEY, fresh)
  } catch {
    // Storage blocked; the id still works for this page load.
  }

  return fresh
}

type RunDetail = {
  id: number
  conversationId: string | null
  question: string
  status: string
  durationMs: number | null
  totalTokens: number | null
  error: string | null
  createdAt: string
  output: AgentOutput | null
  sql: string[]
}

type Conversation = {
  conversationId: string | null
  runs: number
  totalTokens: number
  lastAt: string
  lastQuestion: string
  lastStatus: string
}

const PAGE_SIZE = 10

// Enough of an id to tell two conversations apart. Eight characters is enough
// for a uuid but not for ids a client picks, so this keeps twelve.
function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 12)}…` : id
}

function Pager({
  page,
  total,
  onPage,
}: {
  page: number
  total: number
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (pages <= 1) return null

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/70 px-3 py-2">
      <p className="font-mono text-[0.65rem] text-muted-foreground">
        page {page} of {pages}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Newer
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Older
        </Button>
      </div>
    </div>
  )
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—"
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

function formatWhen(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Upstream errors arrive as whole paragraphs, often with an unbroken URL that
// would force the table wider than the viewport.
function shortError(error: string): string {
  const firstLine = error.split("\n")[0] ?? error
  return firstLine.length > 120 ? `${firstLine.slice(0, 120)}…` : firstLine
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "completed"
      ? "bg-primary/10 text-primary"
      : status === "running"
        ? "bg-muted text-muted-foreground"
        : "bg-destructive/10 text-destructive"

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[0.6rem] tracking-[0.1em] uppercase ${tone}`}
    >
      {status}
    </span>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const session = useSession()
  const [params] = useSearchParams()
  const viewParam = params.get("view")
  const runId = viewParam === "run" ? Number(params.get("id")) : null
  const active =
    VIEWS.find(
      (view) =>
        view.id ===
        (viewParam === "run" || viewParam === "conversation" ? "runs" : viewParam),
    ) ?? VIEWS[0]
  const title =
    runId !== null
      ? "Run detail"
      : viewParam === "conversation"
        ? "Conversation"
        : active.label

  const token = session?.accessToken ?? null

  const [conversations, setConversations] = useState<Conversation[] | null>(null)
  const [conversationsTotal, setConversationsTotal] = useState(0)
  const [conversationsError, setConversationsError] = useState<string | null>(null)
  const [chats, setChats] = useState<Run[] | null>(null)
  const [chatsTotal, setChatsTotal] = useState(0)
  const [chatsError, setChatsError] = useState<string | null>(null)
  const [question, setQuestion] = useState("")
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [detail, setDetail] = useState<RunDetail | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState(readConversationId)
  const [reports, setReports] = useState<Report[] | null>(null)
  const [reportsError, setReportsError] = useState<string | null>(null)
  const [savingReport, setSavingReport] = useState(false)
  const [saveNote, setSaveNote] = useState<string | null>(null)

  const page = Math.max(1, Number(params.get("page") ?? "1") || 1)
  const idParam = params.get("id")
  // An empty id selects the runs made before conversations were recorded.
  const openConversation = viewParam === "conversation" ? (idParam ?? "") : null

  function goToPage(next: number) {
    const nextParams = new URLSearchParams(params)
    nextParams.set("page", String(next))
    navigate(`/dashboard?${nextParams.toString()}`)
  }

  function openConversationAt(conversationId: string | null) {
    navigate(
      `/dashboard?${new URLSearchParams({
        view: "conversation",
        id: conversationId ?? "",
        page: "1",
      }).toString()}`,
    )
  }

  const loadConversations = useCallback(async () => {
    if (token === null) return

    try {
      const response = await fetch(
        `/agent/conversations?limit=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )

      if (!response.ok) {
        setConversationsError("Could not load conversations.")
        return
      }

      const body = (await response.json()) as {
        conversations?: Conversation[]
        total?: number
      }
      setConversations(body.conversations ?? [])
      setConversationsTotal(body.total ?? 0)
      setConversationsError(null)
    } catch {
      setConversationsError("Could not reach the server.")
    }
  }, [token, page])

  useEffect(() => {
    if (viewParam !== "runs") return

    setConversations(null)
    void loadConversations()
  }, [viewParam, loadConversations])

  const loadChats = useCallback(async () => {
    if (token === null || openConversation === null) return

    try {
      const query = new URLSearchParams({
        conversationId: openConversation,
        limit: String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
      })
      const response = await fetch(`/agent/runs?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        setChatsError("Could not load this conversation.")
        return
      }

      const body = (await response.json()) as { runs?: Run[]; total?: number }
      setChats(body.runs ?? [])
      setChatsTotal(body.total ?? 0)
      setChatsError(null)
    } catch {
      setChatsError("Could not reach the server.")
    }
  }, [token, openConversation, page])

  useEffect(() => {
    if (openConversation === null) return

    setChats(null)
    void loadChats()
  }, [openConversation, loadChats])

  const loadReports = useCallback(async () => {
    if (token === null) return

    try {
      const response = await fetch("/reports", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        setReportsError("Could not load reports.")
        return
      }

      const body = (await response.json()) as { reports?: Report[] }
      setReports(body.reports ?? [])
      setReportsError(null)
    } catch {
      setReportsError("Could not reach the server.")
    }
  }, [token])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  // While a PDF is being rendered, poll so the status flips to ready on its own.
  useEffect(() => {
    if (reports === null) return
    if (!reports.some((report) => report.pdfStatus === "pending")) return

    const timer = window.setInterval(() => {
      void loadReports()
    }, 4000)

    return () => window.clearInterval(timer)
  }, [reports, loadReports])

  useEffect(() => {
    if (runId === null || token === null || !Number.isInteger(runId)) return

    let cancelled = false
    setDetail(null)
    setDetailError(null)

    fetch(`/agent/runs/${runId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (cancelled) return

        const body = (await response.json()) as { run?: RunDetail; error?: string }

        if (!response.ok || body.run === undefined) {
          setDetailError(body.error ?? "Could not load that run.")
          return
        }

        setDetail(body.run)
      })
      .catch(() => {
        if (!cancelled) setDetailError("Could not reach the server.")
      })

    return () => {
      cancelled = true
    }
  }, [runId, token])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (token === null || question.trim() === "") return

    setBusy(true)
    setAnswer(null)
    setRunError(null)

    try {
      const response = await fetch("/agent/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question, conversationId }),
      })
      const body = (await response.json()) as Answer & { error?: string }

      if (response.ok) {
        setAnswer(body)
      } else {
        setRunError(body.error ?? "The run failed.")
      }
    } catch {
      setRunError("Could not reach the server.")
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    setSession(null)

    if (token !== null) {
      try {
        await fetch("/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch {
        // The local session is already cleared; revocation can fail quietly.
      }
    }

    navigate("/")
  }

  // A new id means a fresh transcript, so the agent stops carrying context.
  function startConversation() {
    setConversationId(startConversationId())
    setAnswer(null)
    setRunError(null)
    setSaveNote(null)
    setQuestion("")
  }

  async function saveReport() {
    if (token === null || answer?.runId == null) return

    setSavingReport(true)
    setSaveNote(null)

    try {
      const response = await fetch("/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ runId: answer.runId }),
      })
      const body = (await response.json()) as { report?: { id: number }; error?: string }

      if (!response.ok) {
        setSaveNote(body.error ?? "Could not save the report.")
        return
      }

      setSaveNote("Saved. The PDF is being generated in the background.")
      await loadReports()
    } catch {
      setSaveNote("Could not reach the server.")
    } finally {
      setSavingReport(false)
    }
  }

  // The PDF endpoint needs the bearer token, so a plain link cannot fetch it.
  async function downloadReport(report: Report) {
    if (token === null) return

    try {
      const response = await fetch(`/reports/${report.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        const body = (await response.json()) as { error?: string }
        setReportsError(body.error ?? "Could not download that PDF.")
        return
      }

      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement("a")
      link.href = url
      link.download = `recon-report-${report.id}.pdf`
      link.click()
      URL.revokeObjectURL(url)
      setReportsError(null)
    } catch {
      setReportsError("Could not reach the server.")
    }
  }

  return (
    <SidebarProvider>
      {/* The rail holds navigation plus account actions; without a role its
          content sits outside every landmark. On mobile it renders in a Sheet,
          which is already a landmark. */}
      <Sidebar collapsible="offcanvas" role="navigation" aria-label="Dashboard">
        <SidebarHeader className="px-3 py-3">
          <Wordmark href="/" label="Recon, back to the home page" />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {VIEWS.map((view) => (
                  <SidebarMenuItem key={view.id}>
                    <SidebarMenuButton
                      isActive={active.id === view.id}
                      render={<Link to={`/dashboard?view=${view.id}`} />}
                    >
                      <view.icon />
                      <span>{view.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex flex-col gap-0.5 px-2 py-1.5">
                <span className="font-mono text-[0.6rem] tracking-[0.12em] text-muted-foreground uppercase">
                  Signed in as
                </span>
                <span className="truncate text-xs">{session?.email ?? "your account"}</span>
              </div>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={signOut}>
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/70 px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <h1 className="text-sm font-medium">{title}</h1>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 font-mono text-[0.6rem] tracking-[0.12em] text-primary uppercase">
            <ShieldCheck aria-hidden="true" className="size-3" />
            read-only
          </span>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">

          {active.id === "ask" && (
            <Card>
              <CardHeader>
                <CardTitle>Ask a question</CardTitle>
                <CardDescription>
                  Plain language in. The SQL and the numbers come back together.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="flex flex-col gap-3" onSubmit={onSubmit}>
                  <label htmlFor="question" className="text-sm font-medium">
                    Your question
                  </label>
                  <Input
                    id="question"
                    value={question}
                    disabled={busy}
                    placeholder="How many orders are completed?"
                    onChange={(event) => setQuestion(event.target.value)}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={busy || question.trim() === ""}>
                      {busy ? "Running…" : "Run query"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={startConversation}
                      disabled={busy}
                    >
                      New conversation
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Questions in one conversation share context.
                    </p>
                  </div>
                </form>

                <p className="mt-3 font-mono text-[0.65rem] text-muted-foreground">
                  conversation {shortId(conversationId)} · runs in this window share
                  context
                </p>

                {runError !== null && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {runError}
                  </p>
                )}

                {busy && (
                  <div className="mt-4 flex flex-col gap-2" aria-busy="true">
                    <p className="sr-only" role="status">
                      Running the agent
                    </p>
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                )}

                {answer !== null && (
                  <div className="mt-4 flex flex-col gap-4">
                    <Separator />
                    <AnswerView output={answer.output} sql={answer.sql} />
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void saveReport()}
                        disabled={savingReport || answer.runId == null}
                      >
                        {savingReport ? "Saving…" : "Save as report"}
                      </Button>
                      {saveNote !== null && (
                        <p role="status" className="text-xs text-muted-foreground">
                          {saveNote}
                        </p>
                      )}
                    </div>

                    <p className="font-mono text-[0.65rem] text-muted-foreground">
                      {formatDuration(answer.durationMs)} ·{" "}
                      {answer.totalTokens.toLocaleString()} tokens
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {active.id === "runs" && runId === null && openConversation === null && (
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
              {conversationsError !== null && (
                <p role="alert" className="px-4 py-4 text-sm text-destructive">
                  {conversationsError}
                </p>
              )}

              {conversationsError === null && conversations === null && (
                <div className="flex flex-col gap-3 p-4" aria-busy="true">
                  <p className="sr-only" role="status">
                    Loading conversations
                  </p>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              )}

              {conversationsError === null &&
                conversations !== null &&
                conversations.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No conversations yet. Ask a question and it will appear here.
                  </p>
                )}

              {conversations !== null && conversations.length > 0 && (
                <>
                  <table className="w-full border-collapse text-left text-sm">
                    <caption className="sr-only">Your conversations</caption>
                    <thead>
                      <tr className="border-b border-border/70">
                        <th scope="col" className="px-3 py-3 font-medium text-muted-foreground">
                          Conversation
                        </th>
                        <th scope="col" className="px-3 py-3 text-right font-medium text-muted-foreground">
                          Chats
                        </th>
                        <th scope="col" className="px-3 py-3 text-right font-medium text-muted-foreground">
                          Tokens
                        </th>
                        <th scope="col" className="px-3 py-3 text-right font-medium text-muted-foreground">
                          Last
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {conversations.map((conversation) => (
                        <tr
                          key={conversation.conversationId ?? "unfiled"}
                          className="border-b border-border/60 last:border-b-0"
                        >
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => openConversationAt(conversation.conversationId)}
                              className="text-left underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
                            >
                              {conversation.lastQuestion}
                            </button>
                            <p className="mt-1 text-xs text-muted-foreground">
                              <span className="rounded bg-muted px-1 font-mono text-[0.6rem]">
                                {conversation.conversationId === null
                                  ? "before conversations"
                                  : `conv ${shortId(conversation.conversationId)}`}
                              </span>
                            </p>
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-xs tabular-nums">
                            {conversation.runs}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-xs text-muted-foreground tabular-nums">
                            {conversation.totalTokens.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-right text-xs text-muted-foreground">
                            {formatWhen(conversation.lastAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pager page={page} total={conversationsTotal} onPage={goToPage} />
                </>
              )}
            </div>
          )}

          {openConversation !== null && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/dashboard?view=runs")}
                  className="font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
                >
                  {"\u2190"} all conversations
                </button>
                <span className="rounded bg-muted px-1 font-mono text-[0.6rem] text-muted-foreground">
                  {openConversation === ""
                    ? "before conversations"
                    : `conv ${shortId(openConversation)}`}
                </span>
                <span className="font-mono text-[0.65rem] text-muted-foreground">
                  {chatsTotal} {chatsTotal === 1 ? "chat" : "chats"}
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
                {chatsError !== null && (
                  <p role="alert" className="px-4 py-4 text-sm text-destructive">
                    {chatsError}
                  </p>
                )}

                {chatsError === null && chats === null && (
                  <div className="flex flex-col gap-3 p-4" aria-busy="true">
                    <p className="sr-only" role="status">
                      Loading this conversation
                    </p>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                )}

                {chatsError === null && chats !== null && chats.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    This conversation has no runs.
                  </p>
                )}

                {chats !== null && chats.length > 0 && (
                  <>
                    <table className="w-full border-collapse text-left text-sm">
                      <caption className="sr-only">Chats in this conversation</caption>
                      <thead>
                        <tr className="border-b border-border/70">
                          <th scope="col" className="px-3 py-3 font-medium text-muted-foreground">
                            Question
                          </th>
                          <th scope="col" className="px-3 py-3 font-medium text-muted-foreground">
                            Status
                          </th>
                          <th scope="col" className="px-3 py-3 text-right font-medium text-muted-foreground">
                            Time
                          </th>
                          <th scope="col" className="px-3 py-3 text-right font-medium text-muted-foreground">
                            Tokens
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {chats.map((chat) => (
                          <tr key={chat.id} className="border-b border-border/60 last:border-b-0">
                            <td className="px-3 py-3">
                              <Link
                                to={`/dashboard?view=run&id=${chat.id}`}
                                className="underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
                              >
                                {chat.question}
                              </Link>
                              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                                <span>{formatWhen(chat.createdAt)}</span>
                                {chat.error === null ? null : (
                                  <span className="break-words">{shortError(chat.error)}</span>
                                )}
                              </p>
                            </td>
                            <td className="px-3 py-3">
                              <StatusPill status={chat.status} />
                            </td>
                            <td className="px-3 py-3 text-right font-mono text-xs text-muted-foreground tabular-nums">
                              {formatDuration(chat.durationMs)}
                            </td>
                            <td className="px-3 py-3 text-right font-mono text-xs text-muted-foreground tabular-nums">
                              {chat.totalTokens === null ? "\u2014" : chat.totalTokens.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Pager page={page} total={chatsTotal} onPage={goToPage} />
                  </>
                )}
              </div>
            </div>
          )}
          {active.id === "reports" && runId === null && (
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
              {reports !== null && reports.length === 0 && reportsError === null && (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No reports yet. Ask a question, then save the answer as a report.
                </p>
              )}

              {reportsError !== null && (
                <p role="alert" className="px-4 py-4 text-sm text-destructive">
                  {reportsError}
                </p>
              )}

              {reports === null && reportsError === null && (
                <div className="flex flex-col gap-3 p-4" aria-busy="true">
                  <p className="sr-only" role="status">
                    Loading reports
                  </p>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              )}

              {reports !== null && reports.length > 0 && (
                <table className="w-full border-collapse text-left text-sm">
                  <caption className="sr-only">Your saved reports</caption>
                  <thead>
                    <tr className="border-b border-border/70">
                      <th scope="col" className="px-3 py-3 font-medium text-muted-foreground">
                        Report
                      </th>
                      <th scope="col" className="px-3 py-3 font-medium text-muted-foreground">
                        PDF
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3 text-right font-medium text-muted-foreground"
                      >
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((report) => (
                      <tr key={report.id} className="border-b border-border/60 last:border-b-0">
                        <td className="px-3 py-3">
                          <p>{report.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {report.question}
                            {report.pdfError === null ? "" : ` · ${report.pdfError}`}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          {report.pdfStatus === "ready" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void downloadReport(report)}
                            >
                              Download
                            </Button>
                          ) : (
                            <span className="font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                              {report.pdfStatus}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right text-xs text-muted-foreground">
                          {formatWhen(report.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {runId !== null && (
            <div className="flex flex-col gap-4">
              <Link
                to="/dashboard?view=runs"
                className="self-start font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
              >
                ← back to runs
              </Link>

              {detailError !== null && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {detailError}
                </p>
              )}

              {detailError === null && detail === null && (
                <div className="flex flex-col gap-3" aria-busy="true">
                  <p className="sr-only" role="status">
                    Loading the run
                  </p>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              )}

              {detail !== null && (
                <>
                  <div className="rounded-xl border border-border/70 bg-card p-4">
                    <p className="font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                      Input
                    </p>
                    <p className="mt-1">{detail.question}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[0.65rem] text-muted-foreground">
                      <StatusPill status={detail.status} />
                      <span>{formatDuration(detail.durationMs)}</span>
                      <span>
                        {detail.totalTokens === null
                          ? "—"
                          : detail.totalTokens.toLocaleString()}{" "}
                        tokens
                      </span>
                      {detail.conversationId !== null && (
                        <span
                          title={`conversation ${detail.conversationId}`}
                          className="rounded bg-muted px-1 font-mono"
                        >
                          conv {shortId(detail.conversationId)}
                        </span>
                      )}
                      <span>{formatWhen(detail.createdAt)}</span>
                    </div>
                  </div>

                  {detail.error !== null && (
                    <p
                      role="alert"
                      className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      {detail.error}
                    </p>
                  )}

                  {detail.output !== null && (
                    <div className="rounded-xl border border-border/70 bg-card p-4">
                      <p className="font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                        Output
                      </p>
                      <div className="mt-2">
                        <AnswerView output={detail.output} sql={detail.sql} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
