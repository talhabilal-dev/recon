import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Link, Route, Routes } from "react-router"
import { Button } from "../components/ui/button"
import "./index.css"
import App from "./App.tsx"
import { SignIn, SignUp } from "./auth.tsx"
import Dashboard from "./dashboard.tsx"
import { RequireSession } from "./require-session.tsx"
import { VerifyEmail } from "./verify.tsx"

function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="font-mono text-[0.68rem] font-medium tracking-[0.18em] text-primary uppercase">
        404
      </p>
      <h1 className="text-2xl font-medium tracking-tight">That page does not exist.</h1>
      <Button size="lg" render={<Link to="/" />}>
        Back to the home page
      </Button>
    </main>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/verify" element={<VerifyEmail />} />
        <Route
          path="/dashboard"
          element={
            <RequireSession>
              <Dashboard />
            </RequireSession>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
