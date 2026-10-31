import { useSyncExternalStore } from "react"

const STORAGE_KEY = "recon.session"

export type Session = {
  accessToken: string
  refreshToken: string
  expiresAt: number | null
  email?: string
}

function read(): Session | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw === null ? null : (JSON.parse(raw) as Session)
  } catch {
    return null
  }
}

let current = read()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSession(): Session | null {
  return current
}

export function setSession(next: Session | null): void {
  current = next

  try {
    if (next === null) {
      window.localStorage.removeItem(STORAGE_KEY)
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    }
  } catch {
    // Storage blocked; the session still lives in memory for this tab.
  }

  for (const listener of listeners) listener()
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSession, () => null)
}
