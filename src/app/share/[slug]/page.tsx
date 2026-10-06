"use client";

import { use, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { renderMarkdown } from "@/lib/markdown";
import { decodeShare } from "@/lib/share";

/** The fragment is an external store: it can change without a re-render. */
function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const readHash = () => window.location.hash;
const noHash = () => "";

/**
 * Read-only view for a shared note. The document arrives in the URL fragment,
 * so this page works on any static host without a database.
 */
export default function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const hash = useSyncExternalStore(subscribe, readHash, noHash);

  const note = useMemo(() => decodeShare(hash), [hash]);
  const html = useMemo(
    () => (note ? renderMarkdown(note.markdown, { existing: new Set(), currentTitle: "" }) : ""),
    [note],
  );

  if (!hash) {
    return <main className="share-page">Opening…</main>;
  }

  if (!note) {
    return (
      <main className="share-page">
        <h1>Nothing to show</h1>
        <p>
          The link is missing its content. Ask whoever sent it to copy the whole
          thing, the part after the <code>#</code> included.
        </p>
        <Link className="primary-btn" href="/">
          Open Glyph
        </Link>
      </main>
    );
  }

  return (
    <main className="share-page">
      <header className="share-bar">
        <span className="share-badge">Glyph</span>
        <span className="share-name">{note.title || slug}</span>
        <span className="share-by">
          Shared by <strong>{note.author || "Anonymous"}</strong>
        </span>
        <Link className="ghost-btn" href="/">
          Open Glyph
        </Link>
      </header>
      <article className="share-sheet">
        <div className="editor-body" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </main>
  );
}
