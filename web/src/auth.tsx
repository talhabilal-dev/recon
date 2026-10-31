import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { ArrowRight } from "lucide-react"
import { Link, useNavigate } from "react-router"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { setSession, type Session } from "./session.ts"
import { Wordmark } from "./wordmark.tsx"

type Credentials = { session?: Session | null; error?: string }
type SignUpResult = Credentials & { needsEmailConfirmation?: boolean }

const PASSWORD_MIN = 8

export function AuthShell({
  label,
  title,
  subtitle,
  children,
}: {
  label: string
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <div
        aria-hidden="true"
        className="ledger-rules pointer-events-none absolute inset-0 opacity-70"
      />
      <div
        aria-hidden="true"
        className="hero-glow pointer-events-none absolute inset-0 opacity-60"
      />

      <header className="relative border-b border-border/70">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4 sm:px-6 lg:px-8">
          <Wordmark href="/" label="Recon, back to the home page" />
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <p className="font-mono text-[0.68rem] font-medium tracking-[0.18em] text-primary uppercase">
            {label}
          </p>
          <h1 className="mt-3 text-2xl font-medium tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>

          <div className="mt-8 rounded-xl border border-border/70 bg-card p-5 sm:p-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  hint,
  disabled,
}: {
  id: string
  label: string
  type: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  hint?: string
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        required
        disabled={disabled}
        autoComplete={autoComplete}
        aria-describedby={hint === undefined ? undefined : `${id}-hint`}
        onChange={(event) => onChange(event.target.value)}
        className="h-10"
      />
      {hint !== undefined && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {children}
    </p>
  )
}

export function SignIn() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = "Sign in — Recon"
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setBusy(true)

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const result = (await response.json()) as Credentials

      if (!response.ok || !result.session) {
        setError(result.error ?? "Could not sign in. Try again.")
        return
      }

      setSession({ ...result.session, email })
      navigate("/dashboard")
    } catch {
      setError("Could not reach the server. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      label="Welcome back"
      title="Sign in to Recon"
      subtitle="Ask the questions, keep the reports. Every answer arrives with the SQL behind it."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        {error !== null && <ErrorNote>{error}</ErrorNote>}

        <Field
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          disabled={busy}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          disabled={busy}
        />

        <Button type="submit" size="lg" disabled={busy} className="h-10 w-full">
          {busy ? "Signing in…" : "Sign in"}
          {!busy && <ArrowRight />}
        </Button>
      </form>

      <p className="mt-5 text-sm text-muted-foreground">
        No account yet?{" "}
        <Link
          to="/signup"
          className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
        >
          Create one
        </Link>
      </p>
    </AuthShell>
  )
}

export function SignUp() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    document.title = "Create an account — Recon"
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password.length < PASSWORD_MIN) {
      setError(`Use at least ${PASSWORD_MIN} characters for your password.`)
      return
    }

    if (password !== confirm) {
      setError("Those two passwords do not match.")
      return
    }

    setBusy(true)

    try {
      const response = await fetch("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const result = (await response.json()) as SignUpResult

      if (!response.ok) {
        setError(result.error ?? "Could not create that account.")
        return
      }

      if (result.session) {
        setSession({ ...result.session, email })
        navigate("/dashboard")
        return
      }

      setConfirming(true)
    } catch {
      setError("Could not reach the server. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  if (confirming) {
    return (
      <AuthShell
        label="Almost there"
        title="Confirm your email"
        subtitle={`We sent a confirmation link to ${email}. Open it, then sign in.`}
      >
        <Button size="lg" className="h-10 w-full" render={<Link to="/login" />}>
          Go to sign in
          <ArrowRight />
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      label="Get started"
      title="Create your account"
      subtitle="One account holds your saved reports and the history of every run."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        {error !== null && <ErrorNote>{error}</ErrorNote>}

        <Field
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          disabled={busy}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN} characters.`}
          disabled={busy}
        />
        <Field
          id="confirm"
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          disabled={busy}
        />

        <Button type="submit" size="lg" disabled={busy} className="h-10 w-full">
          {busy ? "Creating account…" : "Create account"}
          {!busy && <ArrowRight />}
        </Button>
      </form>

      <p className="mt-5 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          to="/login"
          className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
