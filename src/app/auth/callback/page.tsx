"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Where the OAuth popup lands.
 *
 * It is not a page anyone reads: supabase-js picks the session out of the URL
 * on startup, and then this window closes itself. The opener sees the session
 * through the storage they share.
 */
export default function AuthCallback() {
  useEffect(() => {
    let gone = false;
    const close = () => {
      if (!gone) window.close();
    };

    // `getSession` waits for the client to finish reading the URL, so the
    // session is safely stored before the window goes.
    void supabase?.auth.getSession().finally(() => {
      close();
      setTimeout(close, 1200);
    });

    return () => {
      gone = true;
    };
  }, []);

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1 className="auth-head">Signing you in…</h1>
        <p className="auth-sub">This window closes itself. You can close it too.</p>
      </div>
    </main>
  );
}
