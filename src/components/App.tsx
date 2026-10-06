"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Menu, Settings } from "lucide-react";
import AccountMenu from "@/components/AccountMenu";
import BlockEditor from "@/components/Block";
import QuickSwitcher from "@/components/QuickSwitcher";
import SettingsDialog from "@/components/SettingsDialog";
import ShareDialog from "@/components/ShareDialog";
import Sidebar from "@/components/Sidebar";
import TagsDialog from "@/components/TagsDialog";
import { loadAccount, watchAccount, displayName, type Account } from "@/lib/auth";
import { addTag, removeTag, renameTag, tagsIn } from "@/lib/markdown";
import { seedVault } from "@/lib/seed";
import {
  appliedTheme,
  downloadText,
  loadFont,
  loadPrefs,
  loadVault,
  saveFont,
  savePrefs,
  saveVault,
  type Prefs,
} from "@/lib/storage";
import type { FontId, Folder, Note, Theme, Vault } from "@/lib/types";

const REPO = "https://github.com/lordpipon/glyph";

const uid = () => Math.random().toString(36).slice(2, 10);

export default function App() {
  /**
   * This whole tree renders on the client only (see `app/page.tsx`), so the
   * vault can be read straight out of local storage during the first render
   * instead of flashing the seed notes and swapping them a tick later.
   */
  const [vault, setVault] = useState<Vault>(() => loadVault() ?? seedVault());
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [activeId, setActiveId] = useState<string | null>(() => {
    // Same source as `vault` above, so a first visit still opens the seed note.
    const notes = (loadVault() ?? seedVault()).notes;
    const last = loadPrefs().lastNoteId;
    if (last && notes.some((n) => n.id === last)) return last;
    return notes[0]?.id ?? null;
  });
  const [font, setFont] = useState<FontId>(() => loadFont());
  const [sourceMode, setSourceMode] = useState(false);
  const [renamingTitle, setRenamingTitle] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  // The mirror paints the account chip on the first frame; `watchAccount` below
  // confirms it against Supabase and follows every later change.
  const [account, setAccount] = useState<Account | null>(() => loadAccount());
  const [drawerExiting, setDrawerExiting] = useState(false);
  const drawerTimer = useRef<number | null>(null);

  const theme = prefs.theme;

  /* ---------------- persistence ---------------- */

  // Save to localStorage shortly after the last keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      saveVault(vault);
      setSaved(true);
    }, 300);
    return () => clearTimeout(id);
  }, [vault]);

  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(false), 1600);
    return () => clearTimeout(id);
  }, [saved]);

  useEffect(() => {
    savePrefs({ ...prefs, lastNoteId: activeId });
  }, [prefs, activeId]);

  useEffect(() => {
    document.documentElement.dataset.font = font;
    saveFont(font);
  }, [font]);

  // Supabase is the source of truth for the account: this covers the first read,
  // a sign-in in another tab, and the session quietly expiring.
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    void watchAccount((next) => {
      if (!cancelled) setAccount(next);
    }).then((fn) => {
      if (cancelled) fn();
      else stop = fn;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  // "Device" is a fixed palette now; applying it is just writing the attribute
  // the bootstrap script already painted on the very first frame.
  useEffect(() => {
    document.documentElement.dataset.theme = appliedTheme(theme);
  }, [theme]);

  /* ---------------- derived ---------------- */

  const activeNote = useMemo(
    () => vault.notes.find((n) => n.id === activeId) ?? null,
    [vault.notes, activeId],
  );

  const renderContext = useMemo(
    () => ({
      existing: new Set(vault.notes.map((n) => n.title.toLowerCase())),
      currentTitle: activeNote?.title ?? "",
    }),
    [vault.notes, activeNote?.title],
  );

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of vault.notes) {
      for (const tag of tagsIn(note.content)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return counts;
  }, [vault.notes]);

  const sharedNote = shareId ? (vault.notes.find((n) => n.id === shareId) ?? null) : null;

  /* ---------------- mutations ---------------- */

  const editContent = useCallback((id: string, content: string) => {
    setVault((v) => ({
      ...v,
      notes: v.notes.map((n) => {
        if (n.id !== id) return n;
        const heading = firstHeading(content);
        const adopt = n.autoTitle && heading !== null;
        return {
          ...n,
          content,
          updatedAt: Date.now(),
          title: adopt ? heading : n.title,
          autoTitle: n.autoTitle && adopt,
        };
      }),
    }));
  }, []);

  const patchContent = useCallback(
    (id: string, transform: (content: string) => string) => {
      setVault((v) => ({
        ...v,
        notes: v.notes.map((n) => {
          if (n.id !== id) return n;
          const content = transform(n.content);
          return content === n.content ? n : { ...n, content, updatedAt: Date.now() };
        }),
      }));
    },
    [],
  );

  const createNote = useCallback((title: string, folderId: string | null = null) => {
    const note: Note = {
      id: uid(),
      title,
      autoTitle: title.startsWith("Untitled"),
      content: "",
      folderId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setVault((v) => ({ ...v, notes: [note, ...v.notes] }));
    setActiveId(note.id);
  }, []);

  const createFolder = useCallback((parentId: string | null, name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const folder: Folder = { id: uid(), name: clean, parentId };
    setVault((v) => ({ ...v, folders: [...v.folders, folder] }));
  }, []);

  const renameItem = useCallback((id: string, name: string) => {
    setVault((v) => ({
      ...v,
      notes: v.notes.map((n) =>
        n.id === id ? { ...n, title: name, autoTitle: false, updatedAt: Date.now() } : n,
      ),
      folders: v.folders.map((f) => (f.id === id ? { ...f, name } : f)),
    }));
  }, []);

  const deleteItem = useCallback(
    (id: string) => {
      // The welcome note is the signpost back to how Glyph works, so it stays.
      if (vault.notes.some((n) => n.id === id && n.locked)) return;

      // Deleting a folder takes its whole subtree with it.
      const doomed = new Set<string>([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const f of vault.folders) {
          if (f.parentId && doomed.has(f.parentId) && !doomed.has(f.id)) {
            doomed.add(f.id);
            grew = true;
          }
        }
      }
      const notes = vault.notes.filter(
        (n) => !doomed.has(n.id) && !(n.folderId && doomed.has(n.folderId)),
      );
      setVault({ notes, folders: vault.folders.filter((f) => !doomed.has(f.id)) });
      setActiveId((cur) => (cur && doomed.has(cur) ? (notes[0]?.id ?? null) : cur));
    },
    [vault.folders, vault.notes],
  );

  /** Settings → Reset: back to a single welcome note, tags and all. */
  const resetVault = useCallback(() => {
    const fresh = seedVault();
    setVault(fresh);
    setActiveId(fresh.notes[0].id);
    setTagFilter(null);
  }, []);

  /** Settings → Your data: every note, folder and setting as one JSON file. */
  const downloadData = useCallback(() => {
    const payload = {
      app: "glyph",
      version: 1,
      exportedAt: new Date().toISOString(),
      account: account ? { email: account.email, username: account.username } : null,
      preferences: prefs,
      font,
      notes: vault.notes,
      folders: vault.folders,
    };
    downloadText("glyph-backup.json", JSON.stringify(payload, null, 2), "application/json");
  }, [account, prefs, font, vault.notes, vault.folders]);

  const moveNote = useCallback((id: string, folderId: string | null) => {
    setVault((v) => ({
      ...v,
      notes: v.notes.map((n) => (n.id === id ? { ...n, folderId } : n)),
    }));
  }, []);

  const openNoteByTitle = useCallback(
    (title: string) => {
      const found = vault.notes.find((n) => n.title.toLowerCase() === title.toLowerCase());
      if (found) setActiveId(found.id);
      else createNote(title);
    },
    [vault.notes, createNote],
  );

  const toggleTag = useCallback((tag: string | null) => {
    setTagFilter((cur) => (tag === null ? null : cur === tag ? null : tag));
  }, []);

  /* ---------------- the sidebar drawer ---------------- */

  /**
   * Closing a drawer has to outlive the sidebar by a beat so the exit can be
   * drawn — the element only exists while it is in the DOM. On a wide screen the
   * sidebar is a column with nowhere to slide to, so it just goes.
   */
  const closeSidebar = useCallback(() => {
    if (drawerTimer.current !== null) window.clearTimeout(drawerTimer.current);
    if (!window.matchMedia?.("(max-width: 860px)").matches) {
      setDrawerExiting(false);
      setPrefs((p) => ({ ...p, sidebarOpen: false }));
      return;
    }
    setDrawerExiting(true);
    drawerTimer.current = window.setTimeout(() => {
      drawerTimer.current = null;
      setDrawerExiting(false);
      setPrefs((p) => ({ ...p, sidebarOpen: false }));
    }, 170);
  }, []);

  /** Reopening mid-exit cancels the pending close instead of losing the tap. */
  const toggleSidebar = useCallback(() => {
    if (drawerTimer.current !== null) {
      window.clearTimeout(drawerTimer.current);
      drawerTimer.current = null;
    }
    setDrawerExiting(false);
    setPrefs((p) => ({ ...p, sidebarOpen: !p.sidebarOpen }));
  }, []);

  useEffect(
    () => () => {
      if (drawerTimer.current !== null) window.clearTimeout(drawerTimer.current);
    },
    [],
  );

  /** On a phone the sidebar covers the page, so opening a note closes it. */
  const openNote = useCallback(
    (id: string) => {
      setActiveId(id);
      closeSidebar();
    },
    [closeSidebar],
  );

  /* ---------------- tag editing ---------------- */

  const renameTagEverywhere = useCallback((from: string, to: string) => {
    const clean = to.replace(/^#+/, "").trim();
    if (!clean || clean === from) return;
    setVault((v) => ({
      ...v,
      notes: v.notes.map((n) => {
        const content = renameTag(n.content, from, clean);
        return content === n.content ? n : { ...n, content, updatedAt: Date.now() };
      }),
    }));
    setTagFilter((cur) => (cur === from ? clean : cur));
  }, []);

  const deleteTagEverywhere = useCallback((tag: string) => {
    setVault((v) => ({
      ...v,
      notes: v.notes.map((n) => {
        const content = removeTag(n.content, tag);
        return content === n.content ? n : { ...n, content, updatedAt: Date.now() };
      }),
    }));
    setTagFilter((cur) => (cur === tag ? null : cur));
  }, []);

  const attachTag = useCallback(
    (noteId: string, tag: string) => patchContent(noteId, (c) => addTag(c, tag)),
    [patchContent],
  );

  const detachTag = useCallback(
    (noteId: string, tag: string) => patchContent(noteId, (c) => removeTag(c, tag)),
    [patchContent],
  );

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();

      // Ctrl+N is the browser's "new window" and cannot be stopped from a
      // page, so the new-note shortcut lives on Ctrl+Alt+N instead.
      if (key === "n") {
        if (!e.altKey) return;
        e.preventDefault();
        createNote("Untitled");
        return;
      }

      if (e.altKey) return;
      switch (key) {
        case "p":
        case "k":
          e.preventDefault();
          setSwitcherOpen(true);
          break;
        case "b":
          e.preventDefault();
          toggleSidebar();
          break;
        case "e":
          e.preventDefault();
          setSourceMode((v) => !v);
          break;
        case "s":
          e.preventDefault();
          saveVault(vault);
          setSaved(true);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createNote, toggleSidebar, vault]);

  /* ---------------- render ---------------- */

  return (
    <div className="app">
      {prefs.sidebarOpen && (
        <>
          {/* Only visible under 860px, where the sidebar floats as a drawer. */}
          <button
            className={drawerExiting ? "sidebar-scrim is-closing" : "sidebar-scrim"}
            aria-label="Close sidebar"
            onClick={closeSidebar}
          />
          <Sidebar
            notes={vault.notes}
            folders={vault.folders}
            activeId={activeId}
            tagFilter={tagFilter}
            tagCounts={tagCounts}
            onOpen={openNote}
            exiting={drawerExiting}
            onToggleTag={toggleTag}
            onCreateNote={(folderId) => createNote("Untitled", folderId)}
            onCreateFolder={createFolder}
            onRename={renameItem}
            onDelete={deleteItem}
            onMove={moveNote}
            onShare={setShareId}
            onManageTags={() => setTagsOpen(true)}
          />
        </>
      )}

      <main className="main">
        <header className="topbar">
          <button
            className="icon-btn"
            title="Toggle sidebar (Ctrl+B)"
            onClick={toggleSidebar}
          >
            <Menu />
          </button>

          {activeNote && renamingTitle ? (
            <TitleInput
              key={activeNote.id}
              initial={activeNote.title}
              onCommit={(name) => renameItem(activeNote.id, name)}
              onDone={() => setRenamingTitle(false)}
            />
          ) : (
            <h1
              className="crumb"
              title={activeNote ? "Rename this note" : ""}
              onClick={() => activeNote && setRenamingTitle(true)}
            >
              {activeNote ? activeNote.title : ""}
            </h1>
          )}

          <div className="topbar-right">
            <span className={`saved ${saved ? "is-on" : ""}`}>{saved ? "Saved" : ""}</span>
            {account ? (
              <AccountMenu account={account} onSignedOut={() => setAccount(null)} />
            ) : (
              <Link className="chip-btn topbar-signin" href="/signin">
                Sign in
              </Link>
            )}
            <a
              className="icon-btn"
              href={REPO}
              target="_blank"
              rel="noreferrer noopener"
              title="Glyph on GitHub"
            >
              <GitHubIcon />
            </a>
            <button
              className="icon-btn"
              title="Settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings />
            </button>
          </div>
        </header>

        <div className="paper">
          {activeNote ? (
            sourceMode ? (
              <SourceView
                key={activeNote.id}
                content={activeNote.content}
                onChange={(c) => editContent(activeNote.id, c)}
              />
            ) : (
              <BlockEditor
                key={activeNote.id}
                content={activeNote.content}
                renderContext={renderContext}
                onChange={(c) => editContent(activeNote.id, c)}
                onNavigate={openNoteByTitle}
                onTagClick={toggleTag}
              />
            )
          ) : (
            <p className="empty">No note open. Press Ctrl+Alt+N to start one.</p>
          )}
        </div>
      </main>

      {switcherOpen && (
        <QuickSwitcher
          notes={vault.notes}
          onPick={(id) => {
            setActiveId(id);
            setSwitcherOpen(false);
          }}
          onCreate={(title) => {
            createNote(title);
            setSwitcherOpen(false);
          }}
          onClose={() => setSwitcherOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsDialog
          font={font}
          theme={theme}
          noteCount={vault.notes.length}
          account={account}
          onFont={setFont}
          onTheme={(next: Theme) => setPrefs((p) => ({ ...p, theme: next }))}
          onResetVault={resetVault}
          onDownloadData={downloadData}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {tagsOpen && (
        <TagsDialog
          tagCounts={tagCounts}
          activeNote={activeNote}
          onRenameTag={renameTagEverywhere}
          onDeleteTag={deleteTagEverywhere}
          onAddTagToNote={attachTag}
          onRemoveTagFromNote={detachTag}
          onClose={() => setTagsOpen(false)}
        />
      )}

      {sharedNote && (
        <ShareDialog
          title={sharedNote.title || "Untitled"}
          markdown={sharedNote.content}
          author={displayName(account)}
          onClose={() => setShareId(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SourceView({
  content,
  onChange,
}: {
  content: string;
  onChange: (next: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <textarea
      ref={ref}
      className="source-view"
      value={content}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** An "Untitled" note takes its name from the first heading in the body. */
function firstHeading(content: string): string | null {
  const m = /^#{1,6}\s+(.+)$/.exec((content.split("\n").find((l) => l.trim()) ?? "").trim());
  return m ? m[1].trim() : null;
}

/** Inline rename for the title in the top bar — click it, type, click away. */
function TitleInput({
  initial,
  onCommit,
  onDone,
}: {
  initial: string;
  onCommit: (value: string) => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <input
      className="crumb-input"
      value={value}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        onDone();
        if (value.trim()) onCommit(value.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setValue(initial);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
