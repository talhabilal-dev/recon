import { useEffect, useState, type ReactNode } from "react"
import { Navigate, useLocation } from "react-router"
import { Skeleton } from "../components/ui/skeleton"
import { setSession, useSession } from "./session.ts"
import { VerifyNotice } from "./verify.tsx"

type Status = "checking" | "allowed" | "unverified" | "denied"

export function RequireSession({ children }: { children: ReactNode }) {
  const session = useSession()
  const location = useLocation()
  const [status, setStatus] = useState<Status>(
    session === null ? "denied" : "checking"
  )

  useEffect(() => {
    if (session === null) {
      setStatus("denied")
      return
    }

    let cancelled = false
    setStatus("checking")

    // A token in storage proves nothing on its own, so the API decides. It also
    // tells us whether the address behind it has been confirmed.
    fetch("/auth/me", {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
      .then(async (response) => {
        if (cancelled) return

        if (!response.ok) {
          setSession(null)
          setStatus("denied")
          return
        }

        const body = (await response.json()) as { emailVerified?: boolean }
        if (cancelled) return

        setStatus(body.emailVerified === true ? "allowed" : "unverified")
      })
      .catch(() => {
        if (cancelled) return
        // Could not verify, most likely offline. The token is left in place so
        // signing in again is not required when the connection returns.
        setStatus("denied")
      })

    return () => {
      cancelled = true
    }
  }, [session])

  if (status === "checking") {
    return (
      <div className="flex min-h-svh flex-col gap-4 p-6" aria-busy="true">
        <p className="sr-only">Checking your session…</p>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (status === "unverified") {
    return <VerifyNotice />
  }

  if (status === "denied") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
