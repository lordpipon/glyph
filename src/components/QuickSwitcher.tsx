"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Note } from "@/lib/types";

type Props = {
  notes: Note[];
  onPick: (id: string) => void;
  onClose: () => void;
  onCreate: (title: string) => void;
};

type Match = { note: Note; score: number; hits: boolean[] };

/** Subsequence match with bonuses for word starts and early matches. */
function fuzzy(query: string, target: string): { score: number; hits: boolean[] } | null {
  if (!query) return { score: 0, hits: [] };
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  const hits: boolean[] = new Array(target.length).fill(false);

  let ti = 0;
  let score = 0;
  let streak = 0;
  for (const ch of q) {
    if (ch === " ") continue;
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    hits[found] = true;
    const wordStart = found === 0 || /[\s\-_/]/.test(t[found - 1]);
    streak = found === ti ? streak + 1 : 0;
    score += 10 + streak * 4 + (wordStart ? 12 : 0) - Math.min(found - ti, 12);
    ti = found + 1;
  }
  score -= Math.max(0, target.length - q.length) * 0.15;
  return { score, hits };
}

export default function QuickSwitcher({ notes, onPick, onClose, onCreate }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Resetting the cursor alongside the query keeps it in the same commit. */
  const search = (value: string) => {
    setQuery(value);
    setCursor(0);
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo<Match[]>(() => {
    const matches: Match[] = [];
    for (const note of notes) {
      const m = fuzzy(query, note.title) ?? fuzzy(query, note.content.slice(0, 400));
      if (m) matches.push({ note, ...m });
    }
    return matches.sort((a, b) => b.score - a.score || a.note.title.localeCompare(b.note.title)).slice(0, 40);
  }, [notes, query]);

  const exactExists = useMemo(
    () => notes.some((n) => n.title.toLowerCase() === query.trim().toLowerCase()),
    [notes, query],
  );

  const choose = (index: number) => {
    const match = results[index];
    if (match) onPick(match.note.id);
    else if (query.trim() && !exactExists) onCreate(query.trim());
    else onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (results.length ? (c + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (results.length ? (c - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(cursor);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="switcher" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => search(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Go to note…"
          spellCheck={false}
        />
        <ul className="switcher-list">
          {query.trim() && !exactExists && (
            <li>
              <button className={`switcher-item create ${cursor === -1 ? "is-cursor" : ""}`} onClick={() => choose(-1)}>
                Create “{query.trim()}”
              </button>
            </li>
          )}
          {results.map((match, i) => (
            <li key={match.note.id}>
              <button
                className={`switcher-item ${i === cursor ? "is-cursor" : ""}`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => choose(i)}
              >
                <span className="switcher-title">
                  {match.hits.length > 0 ? (
                    <Highlight text={match.note.title} hits={match.hits} />
                  ) : (
                    match.note.title
                  )}
                </span>
                <span className="switcher-snippet">{snippetOf(match.note.content, query)}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && !query.trim() && (
            <li className="switcher-hint">Type to search. Enter on a title to create it.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function snippetOf(content: string, query: string): string {
  const plain = content.replace(/[#*_`>\[\]]/g, " ").replace(/\s+/g, " ").trim();
  const q = query.trim().toLowerCase();
  const at = q ? plain.toLowerCase().indexOf(q) : 0;
  const start = Math.max(0, at - 30);
  return (start > 0 ? "…" : "") + plain.slice(start, start + 90);
}

function Highlight({ text, hits }: { text: string; hits: boolean[] }) {
  return (
    <>
      {text.split("").map((ch, i) =>
        hits[i] ? (
          <mark key={i}>{ch}</mark>
        ) : (
          <span key={i}>{ch}</span>
        ),
      )}
    </>
  );
}