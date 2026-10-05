"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, type Session } from "@/lib/auth";

/**
 * The signed-in end of the top bar: an avatar that opens the account menu.
 *
 * Nothing here is a page of its own — the session lives in local storage, so
 * showing who is signed in and offering the way out is all this needs to do.
 */
export default function AccountMenu({
  session,
  onSignedOut,
}: {
  session: Session;
  onSignedOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = session.email.slice(0, 1).toUpperCase() || "?";

  return (
    <div className="account" ref={wrap}>
      <button
        className="avatar"
        title={session.email}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>

      {open && (
        <div className="account-pop" role="menu">
          <p className="account-email">{session.email}</p>
          <p className="account-kind">
            {session.cloud
              ? "Synced to your account"
              : "Local account — notes stay in this browser"}
          </p>
          <button
            className="account-signout"
            role="menuitem"
            onClick={() => {
              void signOut().then(onSignedOut);
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
