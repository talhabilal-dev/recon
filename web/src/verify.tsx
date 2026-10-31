import { useEffect, useRef, useState } from "react"
import { ArrowRight } from "lucide-react"
import { Link } from "react-router"
import { Button } from "../components/ui/button"
import { Skeleton } from "../components/ui/skeleton"
import { AuthShell } from "./auth.tsx"
import { setSession, useSession, type Session } from "./session.ts"

type Phase = "working" | "done" | "failed" | "incomplete"

type VerifyResponse = {
  session?: Session | null
  user?: { email?: string }
  error?: string
}

function parseHash(): URLSearchParams {
  return new URLSearchParams(window.location.hash.replace(/^#/, ""))
}

export function VerifyEmail() {
  const [phase, setPhase] = useState<Phase>("working")
  const [message, setMessage] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    document.title = "Verify your email — Recon"
  }, [])

  useEffect(() => {
    // React runs effects twice in development; the link is single use.
    if (started.current) return
    started.current = true

    async function exchangeTokenHash(tokenHash: string, type: string) {
      const response = await fetch("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenHash, type }),
      })
      const result = (await response.json()) as VerifyResponse

      if (!response.ok || !result.session) {
        setMessage(result.error ?? "That link did not work.")
        setPhase("failed")
        return
      }

      setSession({ ...result.session, email: result.user?.email })
      setPhase("done")
    }

    async function adoptFragmentSession(tokens: {
      accessToken: string
      refreshToken: string
    }) {
      setSession({ ...tokens, expiresAt: null })

      // The tokens came from the URL, so the API has to vouch for them.
      const response = await fetch("/auth/me", {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      })

      if (!response.ok) {
        setSession(null)
        setMessage("That link has expired or was already used.")
        setPhase("failed")
        return
      }

      const body = (await response.json()) as { user?: { email?: string } }
      setSession({ ...tokens, expiresAt: null, email: body.user?.email })
      setPhase("done")
    }

    async function run() {
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get("token_hash")
      const fragment = parseHash()

      const fragmentError = fragment.get("error_description")
      const accessToken = fragment.get("access_token")
      const refreshToken = fragment.get("refresh_token")

      // Leave nothing usable behind in the address bar or history.
      window.history.replaceState(null, "", "/verify")

      if (tokenHash !== null) {
        await exchangeTokenHash(tokenHash, params.get("type") ?? "magiclink")
        return
      }

      if (accessToken !== null && refreshToken !== null) {
        await adoptFragmentSession({ accessToken, refreshToken })
        return
      }

      if (fragmentError !== null) {
        setMessage(fragmentError)
        setPhase("failed")
        return
      }

      setPhase("incomplete")
    }

    run().catch(() => {
      setMessage("Could not reach the server. Check your connection and try again.")
      setPhase("failed")
    })
  }, [])

  if (phase === "working") {
    return (
      <AuthShell
        label="Almost there"
        title="Confirming your email"
        subtitle="This only takes a moment."
      >
        <div className="flex flex-col gap-3" aria-busy="true">
          <p className="sr-only" role="status">
            Verifying your link
          </p>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </AuthShell>
    )
  }

  if (phase === "done") {
    return (
      <AuthShell
        label="Verified"
        title="Your email is confirmed"
        subtitle="You are signed in. The dashboard is where you ask the questions."
      >
        <Button size="lg" className="h-10 w-full" render={<Link to="/dashboard" />}>
          Go to the dashboard
          <ArrowRight />
        </Button>
      </AuthShell>
    )
  }

  if (phase === "failed") {
    return (
      <AuthShell
        label="Link problem"
        title="We could not confirm that link"
        subtitle={message ?? "That link has expired or was already used."}
      >
        <div className="flex flex-col gap-3">
          <Button size="lg" className="h-10 w-full" render={<Link to="/login" />}>
            Sign in
            <ArrowRight />
          </Button>
          <p className="text-xs text-muted-foreground">
            Signing in sends a fresh link if your address still needs confirming.
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      label="Nothing to confirm"
      title="This page needs a link from your email"
      subtitle="Open the newest email from Recon and follow its confirmation link."
    >
      <Button size="lg" className="h-10 w-full" render={<Link to="/login" />}>
        Go to sign in
        <ArrowRight />
      </Button>
    </AuthShell>
  )
}

export function VerifyNotice() {
  const session = useSession()

  function signOut() {
    setSession(null)
  }

  return (
    <AuthShell
      label="One step left"
      title="Confirm your email first"
      subtitle={
        session?.email === undefined
          ? "Your address still needs confirming before the dashboard opens."
          : `We sent a confirmation link to ${session.email}. Open it and the dashboard unlocks.`
      }
    >
      <div className="flex flex-col gap-3">
        <Button size="lg" variant="outline" className="h-10 w-full" onClick={signOut}>
          Use a different account
        </Button>
        <p className="text-xs text-muted-foreground">
          The link lands on this site and signs you straight in.
        </p>
      </div>
    </AuthShell>
  )
}
