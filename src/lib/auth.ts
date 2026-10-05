/**
 * The account layer.
 *
 * Supabase is not connected yet, so every call here validates its input and
 * then reports that the cloud half is still missing. Nothing pretends to work:
 * put the two keys below in `.env.local` and replace each body with the matching
 * `supabase.auth.*` call, and the forms in `components/AuthPanel.tsx` start
 * talking to a real project without touching the UI.
 *
 * What an account is for: the vault in this browser is local only, so it dies
 * with the browser data. Signing in stores the same notes in the cloud, which
 * is what makes them follow you to another machine and survive a wipe.
 *
 * Until then there is still a session to design against, so it lives in
 * `localStorage` and `cloud: false`. Everything that reads it (the topbar chip,
 * the sign-out button) treats a local session exactly like a real one — that is
 * the whole point of keeping the shape stable — and the one thing it does not
 * do is move notes anywhere. `signInLocally` is the seam to delete.
 */

export type AuthProvider = "google" | "github";

export type AuthResult = { ok: true; message: string } | { ok: false; message: string };

/**
 * Who is signed in. `cloud` says whether the notes behind this account live on
 * a Supabase server or in this browser, which the UI shows honestly rather than
 * implying sync that is not happening.
 */
export type Session = { email: string; cloud: boolean; since: number };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True once both keys are present, i.e. once a real Supabase project is wired. */
export const cloudReady = SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";

const AWAITING_CLOUD =
  "Cloud sync is not connected yet. Add NEXT_PUBLIC_SUPABASE_URL and " +
  "NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local to switch this on.";

/** The copy shown on both account pages about what signing in changes. */
export const ACCOUNT_PITCH =
  "Your notes currently live in this browser only — clearing site data takes them " +
  "with it. An account keeps the same notes in the cloud, so they open on any " +
  "browser and stay put when this one is wiped.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SESSION_KEY = "glyph.session.v1";

/** The session, or null when nobody is signed in. */
export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
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

function storeSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

/**
 * A browser-only account, so the session UI is real before the cloud is. It
 * changes nothing about where the notes live — delete this and its button once
 * Supabase is wired.
 */
export async function signInLocally(email: string): Promise<AuthResult> {
  const clean = email.trim();
  if (!EMAIL_RE.test(clean)) return { ok: false, message: "That email does not look right." };
  storeSession({ email: clean, cloud: false, since: Date.now() });
  return { ok: true, message: "Signed in for this browser." };
}

/** Drops the session. The vault is untouched: it was never in it. */
export async function signOut(): Promise<AuthResult> {
  // await client.auth.signOut();
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  return { ok: true, message: "Signed out." };
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthResult> {
  const clean = email.trim();
  if (!EMAIL_RE.test(clean)) return { ok: false, message: "That email does not look right." };
  if (!password) return { ok: false, message: "Enter your password." };

  // const { error } = await client.auth.signInWithPassword({ email: clean, password });
  return { ok: false, message: AWAITING_CLOUD };
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

  // const { error } = await client.auth.signUp({ email: clean, password });
  return { ok: false, message: AWAITING_CLOUD };
}

export async function signInWithOAuth(provider: AuthProvider): Promise<AuthResult> {
  const label = provider === "google" ? "Google" : "GitHub";
  if (!cloudReady) {
    return { ok: false, message: `${label} sign-in is not connected yet — it needs the same two keys as the form below.` };
  }

  // await client.auth.signInWithOAuth({ provider, options: { redirectTo: origin } });
  return { ok: false, message: AWAITING_CLOUD };
}
