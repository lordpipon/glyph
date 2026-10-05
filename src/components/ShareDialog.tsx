"use client";

import { useState } from "react";
import Dialog from "@/components/Dialog";
import { copyText, encodeShare } from "@/lib/share";

/**
 * A share link is a real URL: `/share/<name>.md` with the document tucked into
 * the fragment. No server, no database — the link carries the note.
 */
export default function ShareDialog({
  title,
  markdown,
  onClose,
}: {
  title: string;
  markdown: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const url = encodeShare(markdown, title);
  const huge = url.length > 8000;

  const copy = async () => {
    const ok = await copyText(url);
    setCopied(ok ? "done" : "failed");
    if (ok) window.setTimeout(() => setCopied("idle"), 1800);
  };

  return (
    <Dialog title="Share this note" onClose={onClose} width={460}>
      <p className="dialog-lead">
        Anyone with this link can read the note. It opens as a page, and Glyph is
        not required.
      </p>

      <div className="share-row">
        <input className="field mono" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        <button className="primary-btn" onClick={copy}>
          {copied === "done" ? "Copied" : copied === "failed" ? "Copy failed" : "Copy"}
        </button>
      </div>

      <p className="dialog-note">
        {copied === "failed" ? (
          <>The clipboard is blocked here — select the link and copy it by hand.</>
        ) : huge ? (
          <>
            This note is long, so the link is {Math.round(url.length / 1000)}k characters. Some
            chat apps will cut it off — Download is safer for big notes.
          </>
        ) : (
          <>The whole note travels inside the link, which keeps it working on any static host.</>
        )}
      </p>

      <div className="dialog-actions">
        <a className="ghost-btn" href={url} target="_blank" rel="noreferrer noopener">
          Open link
        </a>
        <button className="primary-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </Dialog>
  );
}
