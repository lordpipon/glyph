/**
 * The account layer.
 *
 * Everything here talks to Supabase through the client in `supabase.ts`, and
 * degrades to an honest "not connected" when the two keys are missing, so a
 * clone without a `.env.local` still runs.
 *
 * Two details worth knowing:
 *
 * - `glyph.session.v1` is only a mirror. Supabase keeps the real session, but
 *   reading it is asynchronous; the mirror lets the top bar paint the signed-in
 *   state on the first frame and `watchSession` corrects it a tick later.
 * - Google and GitHub sign in from a popup. Supabase is the OAuth broker, so
 *   going straight there would drag `supabase.co/auth/v1/authorize` across the
 *   address bar twice. The popup hides that hop and hands the session back
 *   through local storage.
 */

import { cloudReady, supabase } from "./supabase";
import type { Session as SupabaseSession } from "@supabase/supabase-js";

export type AuthProvider = "google" | "github";

export type AuthResult =
  | { ok: true; message: string; /** false keeps the reader on this page */ home?: boolean }
  | { ok: false; message: string };

export type Account = { email: string; cloud: boolean; since: number };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIRROR_KEY = "glyph.session.v1";

const AWAITING_CLOUD =
  "Cloud sync is not connected yet. Add NEXT_PUBLIC_SUPABASE_URL and " +
  "NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local to switch this on.";

/** The copy shown on both account pages about what signing in changes. */
export const ACCOUNT_PITCH =
  "Your notes currently live in this browser only. An account is what lets them " +
  "follow you to another browser and survive a wipe — the note storage in the " +
  "cloud is the next piece, and until it is in, signing in changes nothing about " +
  "where your notes are.";

/** Where the OAuth popup lands. It exists only to hand the session over. */
export const CALLBACK_PATH = "/auth/callback";

/* ------------------------------------------------------------------ *
 * The session mirror
 * ------------------------------------------------------------------ */

export function loadAccount(): Account | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Account>;
    if (typeof parsed.email !== "string" || !EMAIL_RE.test(parsed.email)) return null;
    return {
      email: parsed.email,
      cloud: parsed.cloud === true,
      since: typeof parsed.since === "number" ? parsed.since : Date.now(),
    };
  } catch {
    return null;
  }
}

function writeMirror(account: Account | null): void {
  try {
    if (account) localStorage.setItem(MIRROR_KEY, JSON.stringify(account));
    else localStorage.removeItem(MIRROR_KEY);
  } catch {
    /* ignore */
  }
}

function toAccount(session: SupabaseSession | null): Account | null {
  const email = session?.user?.email;
  if (!email) return null;
  return { email, cloud: true, since: session.user.created_at ? Date.parse(session.user.created_at) : Date.now() };
}

/**
 * Reports the current account and every later change — sign in, sign out, token
 * refresh, and the same events happening in another tab. Returns a stop
 * function.
 */
export async function watchAccount(onChange: (account: Account | null) => void): Promise<() => void> {
  if (!supabase) {
    onChange(loadAccount());
    return () => {};
  }

  const push = (session: SupabaseSession | null) => {
    const account = toAccount(session);
    writeMirror(account);
    onChange(account);
  };

  const { data } = await supabase.auth.getSession();
  push(data.session);

  const { data: events } = supabase.auth.onAuthStateChange((_event, session) => push(session));
  return () => events.subscription.unsubscribe();
}

/* ------------------------------------------------------------------ *
 * Signing in and out
 * ------------------------------------------------------------------ */

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const clean = email.trim();
  if (!EMAIL_RE.test(clean)) return { ok: false, message: "That email does not look right." };
  if (!password) return { ok: false, message: "Enter your password." };
  if (!supabase) return { ok: false, message: AWAITING_CLOUD };

  const { error } = await supabase.auth.signInWithPassword({ email: clean, password });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Signed in.", home: true };
}

export async function signUpWithPassword(
  email: string,
  password: string,
  confirm: string,
): Promise<AuthResult> {
  const clean = email.trim();
  if (!EMAIL_RE.test(clean)) return { ok: false, message: "That email does not look right." };
  if (password.length < 8) {
    return { ok: false, message: "Use at least 8 characters for the password." };
  }
  if (password !== confirm) {
    return { ok: false, message: "The two passwords do not match." };
  }
  if (!supabase) return { ok: false, message: AWAITING_CLOUD };

  const { data, error } = await supabase.auth.signUp({
    email: clean,
    password,
    options: { emailRedirectTo: location.origin },
  });
  if (error) return { ok: false, message: error.message };

  // With email confirmation on, Supabase sends the link instead of a session.
  if (!data.session) {
    return { ok: true, home: false, message: `Almost there — open the link in ${clean} to confirm, then sign in.` };
  }
  return { ok: true, message: "Account created.", home: true };
}

/**
 * Google and GitHub, in a popup.
 *
 * `skipBrowserRedirect` hands back the URL instead of navigating to it, so the
 * main tab never shows the Supabase hop. The popup comes back to
 * `/auth/callback`, writes the session where both windows can see it, and this
 * promise resolves.
 */
export async function signInWithOAuth(provider: AuthProvider): Promise<AuthResult> {
  const client = supabase;
  if (!client) {
    const label = provider === "google" ? "Google" : "GitHub";
    return { ok: false, message: `${label} sign-in is not connected yet — it needs the same two keys as the form below.` };
  }

  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: { skipBrowserRedirect: true, redirectTo: `${location.origin}${CALLBACK_PATH}` },
  });
  if (error || !data.url) return { ok: false, message: error?.message ?? "That provider did not answer." };

  const popup = window.open(data.url, "glyph-oauth", "width=520,height=680,center");
  if (!popup) {
    return {
      ok: false,
      message: "The browser blocked the sign-in window. Allow popups for this site, or use the email form below.",
    };
  }

  return new Promise<AuthResult>((resolve) => {
    let settled = false;
    const finish = (result: AuthResult) => {
      if (settled) return;
      settled = true;
      clearInterval(watch);
      clearTimeout(giveUp);
      listener.subscription.unsubscribe();
      if (!popup.closed) popup.close();
      resolve(result);
    };

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (session) finish({ ok: true, message: "Signed in.", home: true });
    });

    // Two ways to notice the end: the session landing in storage, or the reader
    // closing the window. Watching both means neither way out hangs.
    const watch = setInterval(async () => {
      if (popup.closed) {
        finish({ ok: false, message: "That window closed before the sign-in finished." });
        return;
      }
      const { data: current } = await client.auth.getSession();
      if (current.session) finish({ ok: true, message: "Signed in.", home: true });
    }, 700);

    const giveUp = setTimeout(
      () => finish({ ok: false, message: "That took too long. Try again, or use the email form." }),
      5 * 60_000,
    );
  });
}

export async function signOut(): Promise<AuthResult> {
  if (supabase) await supabase.auth.signOut();
  writeMirror(null);
  return { ok: true, message: "Signed out." };
}

export { cloudReady };
