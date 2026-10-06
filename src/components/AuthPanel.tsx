"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  ACCOUNT_PITCH,
  loadAccount,
  signInWithEmailOrUsername,
  signInWithOAuth,
  signUpWithPassword,
  type AuthResult,
} from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Sign in and create account, which are the same form with a different ending.
 * `mode` decides the copy, the fields and where the link at the bottom points.
 */
export default function AuthPanel({ mode }: { mode: "signin" | "register" }) {
  const register = mode === "register";
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Already signed in — the app has the account menu, which is where sign out
  // lives, so there is nothing to do on this page.
  useEffect(() => {
    if (loadAccount()) router.replace("/");
  }, [router]);

  const run = async (task: Promise<AuthResult>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await task;
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.home === false) setNotice(result.message);
    else router.push("/");
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-top">
          <Link className="back-link" href="/">
            <ArrowLeft /> Glyph
          </Link>
        </div>

        <h1 className="auth-head">
          {register ? "Create your account" : "Welcome back"}
        </h1>
        <p className="auth-sub">
          {register
            ? "One account for your notes, on every browser you use."
            : "Sign in to open the notes you left in the cloud."}
        </p>

        <div className="oauth-row">
          <Button
            type="button"
            variant="outline"
            className="oauth-btn"
            disabled={busy}
            onClick={() => run(signInWithOAuth("google"))}
          >
            <GoogleIcon /> Google
          </Button>
          <Button
            type="button"
            variant="outline"
            className="oauth-btn"
            disabled={busy}
            onClick={() => run(signInWithOAuth("github"))}
          >
            <GitHubIcon /> GitHub
          </Button>
        </div>

        <div className="auth-or" aria-hidden>
          <span>or with an email</span>
        </div>

        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              register
                ? signUpWithPassword(username, email, password, confirm)
                : signInWithEmailOrUsername(identifier, password),
            );
          }}
        >
          {register ? (
            <>
              <label className="auth-label">
                <span>Username</span>
                <Input
                  value={username}
                  autoCapitalize="none"
                  autoComplete="username"
                  placeholder="how people know you"
                  spellCheck={false}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>

              <label className="auth-label">
                <span>Email</span>
                <Input
                  type="email"
                  value={email}
                  autoComplete="email"
                  placeholder="you@example.com"
                  spellCheck={false}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </>
          ) : (
            <label className="auth-label">
              <span>Email or username</span>
              <Input
                value={identifier}
                autoCapitalize="none"
                autoComplete="username"
                placeholder="you@example.com or your-username"
                spellCheck={false}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </label>
          )}

          <label className="auth-label">
            <span>Password</span>
            <Input
              type="password"
              value={password}
              autoComplete={register ? "new-password" : "current-password"}
              placeholder={register ? "At least 8 characters" : "Your password"}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {register && (
            <label className="auth-label">
              <span>Confirm password</span>
              <Input
                type="password"
                value={confirm}
                autoComplete="new-password"
                placeholder="Type it again"
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
          )}

          {error && <p className="auth-error">{error}</p>}
          {notice && <p className="auth-notice">{notice}</p>}

          <Button className="auth-submit" type="submit" disabled={busy}>
            {busy ? "Working…" : register ? "Create account" : "Sign in"}
          </Button>
        </form>

        <p className="auth-alt">
          {register ? (
            <>
              Already have an account? <Link href="/signin">Sign in!</Link>
            </>
          ) : (
            <>
              Don&apos;t have an account? <Link href="/register">Create one!</Link>
            </>
          )}
        </p>

        <p className="auth-note">{ACCOUNT_PITCH}</p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        d="M15.2 8.2c0-.6-.05-1.1-.16-1.6H8v3.1h4.06a3.5 3.5 0 01-1.5 2.28v1.9h2.44c1.43-1.32 2.2-3.26 2.2-5.68z"
        fill="#4285f4"
      />
      <path
        d="M8 15.6c2.03 0 3.73-.67 4.97-1.83l-2.44-1.89c-.65.44-1.53.76-2.53.76a4.4 4.4 0 01-4.16-3.03H1.3v1.98A7.6 7.6 0 008 15.6z"
        fill="#34a853"
      />
      <path
        d="M3.84 9.61a4.6 4.6 0 010-2.93V4.7H1.3a7.6 7.6 0 000 6.9l2.54-1.99z"
        fill="#fbbc05"
      />
      <path
        d="M8 3.02c1.1 0 2.08.38 2.86 1.12l2.14-2.14C11.72.8 9.98.13 8 .13A7.6 7.6 0 001.3 4.7l2.54 1.98A4.4 4.4 0 018 3.02z"
        fill="#ea4335"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"
        fill="currentColor"
      />
    </svg>
  );
}