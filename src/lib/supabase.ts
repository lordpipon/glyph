import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The Supabase client, or nothing at all.
 *
 * Both keys are public: the anon key is designed to sit in the browser and is
 * only dangerous without the row policies that come with a real project. The
 * OAuth client secrets stay in Supabase and never reach this file.
 *
 * When the two keys are missing the app still runs — it just says so instead of
 * pretending, and every auth call in `auth.ts` takes the "no cloud" path.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True once both keys are present, i.e. once a real Supabase project is wired. */
export const cloudReady = URL !== "" && ANON_KEY !== "";

export const supabase: SupabaseClient | null = cloudReady ? createClient(URL, ANON_KEY) : null;
