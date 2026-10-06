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
import type { Session as SupabaseSession, UserIdentity } from "@supabase/supabase-js";

export type AuthProvider = "google" | "github";

export type AuthResult =
  | { ok: true; message: string; /** false keeps the reader on this page */ home?: boolean }
  | { ok: false; message: string };

export type Account = { email: string; username?: string; cloud: boolean; since: number };

export type Identity = {
  id: string;
  provider: "google" | "github";
  email?: string;
  /** the full identity object, needed by `unlinkIdentity` */
  raw: UserIdentity;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;
const MIRROR_KEY = "glyph.session.v1";

const AWAITING_CLOUD =
  "Cloud sync is not connected yet. The app reads NEXT_PUBLIC_SUPABASE_URL and " +
  "NEXT_PUBLIC_SUPABASE_ANON_KEY — exactly those names, the prefix is required " +
  "because the browser has to see them — from .env.local locally or from your " +
  "host's env vars. Either way it needs a rebuild afterwards, since Next inlines " +
  "them at build time.";

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
      username: typeof parsed.username === "string" ? parsed.username : undefined,
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
  const username =
    typeof session.user.user_metadata?.username === "string"
      ? session.user.user_metadata.username
      : undefined;
  return {
    email,
    username,
    cloud: true,
    since: session.user.created_at ? Date.parse(session.user.created_at) : Date.now(),
  };
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

/** An email, or a username that the profiles table can map to an email. */
export async function signInWithEmailOrUsername(
  identifier: string,
  password: string,
): Promise<AuthResult> {
  const clean = identifier.trim();
  if (!clean) return { ok: false, message: "Enter your email or username." };
  if (!password) return { ok: false, message: "Enter your password." };
  if (!supabase) return { ok: false, message: AWAITING_CLOUD };

  let email = clean;
  if (!EMAIL_RE.test(clean)) {
    const resolved = await resolveEmailToUsername(clean);
    if (resolved === null) {
      return {
        ok: false,
        message: `No account uses the username “${clean}”. Check the spelling, or use the email you signed up with.`,
      };
    }
    email = resolved;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.toLowerCase().includes("invalid login credentials")) {
      return { ok: false, message: "That email or password is not right." };
    }
    return { ok: false, message: error.message };
  }
  return { ok: true, message: "Signed in.", home: true };
}

/**
 * Signs in to confirm the current password before an email or password change.
 */
export async function verifyPassword(password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, message: AWAITING_CLOUD };
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user.email;
  if (!email) return { ok: false, message: "No one seems to be signed in." };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: "The current password is not right." };
  return { ok: true, message: "Password confirmed." };
}

export async function signUpWithPassword(
  username: string,
  email: string,
  password: string,
  confirm: string,
): Promise<AuthResult> {
  const cleanName = username.trim();
  if (!USERNAME_RE.test(cleanName)) {
    return {
      ok: false,
      message:
        "Usernames are 3–20 letters, numbers, dashes or underscores (no spaces).",
    };
  }
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
    options: { emailRedirectTo: location.origin, data: { username: cleanName } },
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
  return oauthPopup(provider, "signin");
}

export async function signOut(): Promise<AuthResult> {
  if (supabase) await supabase.auth.signOut();
  writeMirror(null);
  return { ok: true, message: "Signed out." };
}

/* ------------------------------------------------------------------ *
 * Account management — Settings shows these to a signed-in reader
 * ------------------------------------------------------------------ */

/**
 * Usernames live in `user_metadata`, so nothing more is needed to change one.
 * The profile row follows when the public table exists.
 */
export async function changeUsername(username: string): Promise<AuthResult> {
  const clean = username.trim();
  if (!USERNAME_RE.test(clean)) {
    return {
      ok: false,
      message: "Usernames are 3–20 letters, numbers, dashes or underscores (no spaces).",
    };
  }
  if (!supabase) return { ok: false, message: AWAITING_CLOUD };

  const { data, error } = await supabase.auth.updateUser({
    data: { username: clean },
  });
  if (error) return { ok: false, message: error.message };

  // Best effort: keep the profiles table (if it exists) in step with the name.
  const userId = data.user?.id;
  if (userId) {
    try {
      await supabase
        .from("profiles")
        .upsert({ id: userId, username: clean }, { onConflict: "id" });
    } catch {
      /* table not set up; the metadata alone is enough to identify the reader */
    }
  }

  const session = (await supabase.auth.getSession()).data.session;
  writeMirror(toAccount(session));
  return { ok: true, message: "Username updated." };
}

export async function changeEmail(
  currentEmail: string,
  newEmail: string,
  currentPassword: string,
): Promise<AuthResult> {
  if (!EMAIL_RE.test(currentEmail.trim())) return { ok: false, message: "The current email does not look right." };
  if (!EMAIL_RE.test(newEmail.trim())) return { ok: false, message: "The new email does not look right." };
  if (currentEmail.trim() === newEmail.trim()) return { ok: false, message: "That is the same email." };
  if (!supabase) return { ok: false, message: AWAITING_CLOUD };

  const check = await verifyPassword(currentPassword);
  if (!check.ok) return check;

  const { data, error } = await supabase.auth.updateUser(
    { email: newEmail.trim() },
    { emailRedirectTo: location.origin },
  );
  if (error) return { ok: false, message: error.message };

  const session = data.user
    ? ((await supabase.auth.getSession()).data.session)
    : null;
  writeMirror(toAccount(session));
  return {
    ok: true,
    message:
      "A confirmation link is on its way to the new address — the email changes once it is opened.",
  };
}

export async function changePassword(
  currentPassword: string,
  nextPassword: string,
  confirm: string,
): Promise<AuthResult> {
  if (nextPassword.length < 8) {
    return { ok: false, message: "Use at least 8 characters for the new password." };
  }
  if (nextPassword !== confirm) {
    return { ok: false, message: "The two new passwords do not match." };
  }
  if (!supabase) return { ok: false, message: AWAITING_CLOUD };

  const check = await verifyPassword(currentPassword);
  if (!check.ok) return check;

  const { error } = await supabase.auth.updateUser({ password: nextPassword });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Password updated." };
}

/** Which providers the account already has, so Settings can show Link/Unlink. */
export async function listIdentities(): Promise<Identity[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error || !data) return [];
  return data.identities
    .filter((i) => i.provider === "google" || i.provider === "github")
    .map((i) => ({
      id: i.id,
      provider: i.provider as "google" | "github",
      email: typeof i.identity_data?.email === "string" ? i.identity_data.email : undefined,
      raw: i,
    }));
}

/** Same popup dance as sign-in, but attaching the provider to the session. */
export function linkProvider(provider: AuthProvider): Promise<AuthResult> {
  return oauthPopup(provider, "link");
}

export async function unlinkProvider(provider: AuthProvider): Promise<AuthResult> {
  if (!supabase) return { ok: false, message: AWAITING_CLOUD };
  const identities = await listIdentities();
  const target = identities.find((i) => i.provider === provider);
  if (!target) return { ok: false, message: "That provider is not linked." };
  if (identities.length <= 1) {
    return {
      ok: false,
      message: "That is the only way into this account — add an email or another provider first.",
    };
  }
  const { error } = await supabase.auth.unlinkIdentity(target.raw);
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: `Unlinked ${provider === "google" ? "Google" : "GitHub"}.` };
}

/** Destroy the Supabase user. Backed by the `delete_account` SQL function. */
export async function deleteAccount(): Promise<AuthResult> {
  if (!supabase) return { ok: false, message: AWAITING_CLOUD };
  const { error } = await supabase.rpc("delete_account");
  if (error) {
    return {
      ok: false,
      message:
        "The delete-account function is not set up yet (" +
        error.message +
        "). Run supabase/setup.sql in the SQL editor and try again.",
    };
  }
  writeMirror(null);
  return { ok: true, message: "Account deleted. Your notes stay in this browser.", home: true };
}

/** The name a shared note shows under: username, or "Anonymous". */
export function displayName(account: Account | null): string {
  if (!account) return "Anonymous";
  return account.username?.trim() || "Anonymous";
}

/** One way to email a username: an RPC, or a readable profiles table. */
async function resolveEmailToUsername(username: string): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("lookup_email", { username });
    if (!error && typeof data === "string" && data) return data;
  } catch {
    /* no function yet — try the table below */
  }
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("email")
      .eq("username", username)
      .maybeSingle();
    if (!error && data && typeof data.email === "string") return data.email;
  } catch {
    /* profiles table missing; setup.sql creates it */
  }
  return null;
}

export async function oauthPopup(
  provider: AuthProvider,
  mode: "signin" | "link" = "signin",
): Promise<AuthResult> {
  const client = supabase;
  if (!client) {
    const label = provider === "google" ? "Google" : "GitHub";
    return { ok: false, message: `${label} sign-in is not connected yet — it needs the same two keys as the form below.` };
  }

  const { data, error } =
    mode === "link"
      ? await client.auth.linkIdentity({
          provider,
          options: { skipBrowserRedirect: true, redirectTo: `${location.origin}${CALLBACK_PATH}` },
        })
      : await client.auth.signInWithOAuth({
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

    const { data: listener } = client.auth.onAuthStateChange(async (event, session) => {
      // Subscribing replays the current session as INITIAL_SESSION right away.
      // For a link that is the account we already have — not proof the popup
      // finished. Treating it as done was slamming the window shut no sooner
      // than it opened. Same for silent background refresh: only a real
      // sign-in, or a link whose new identity actually shows up, counts.
      if (event === "INITIAL_SESSION" || event === "SIGNED_OUT") return;
      if (session) {
        if (mode === "link") {
          const { data: idents } = await client.auth.getUserIdentities();
          const linked = idents?.identities?.some((i) => i.provider === provider) ?? false;
          if (!linked) return;
        }
        finish({ ok: true, message: "Done.", home: mode === "signin" });
      }
    });

    // Two ways to notice the end: the session landing in storage, or the reader
    // closing the window. Watching both means neither way out hangs.
    const watch = setInterval(async () => {
      if (popup.closed) {
        finish({ ok: false, message: "That window closed before the sign-in finished." });
        return;
      }
      const { data: current } = await client.auth.getSession();
      if (current.session) finish({ ok: true, message: "Done.", home: mode === "signin" });
    }, 700);

    const giveUp = setTimeout(
      () => finish({ ok: false, message: "That took too long. Try again, or use the email form." }),
      5 * 60_000,
    );
  });
}

export { cloudReady };
