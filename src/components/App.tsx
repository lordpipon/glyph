"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Lock, Menu, Settings, X } from "lucide-react";
import BlockEditor from "@/components/Block";
import ConfirmDialog from "@/components/ConfirmDialog";
import { PromptDialog } from "@/components/Dialog";
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
  const [flash, setFlash] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [folderPrompt, setFolderPrompt] = useState<{ parentId: string | null } | null>(null);
  // The Ctrl+C copy of a note; Ctrl+V turns it into a new note.
  const copiedRef = useRef<{ title: string; content: string } | null>(null);
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
      setFlash("Saved");
    }, 300);
    return () => clearTimeout(id);
  }, [vault]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(id);
  }, [flash]);

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
        // Read-only notes (the welcome page) never change.
        if (n.locked) return n;
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
          if (n.id !== id || n.locked) return n;
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
        n.id === id && !n.locked
          ? { ...n, title: name, autoTitle: false, updatedAt: Date.now() }
          : n,
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
      notes: v.notes.map((n) => (n.id === id && !n.locked ? { ...n, folderId } : n)),
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
  const openNote = useCallback((id: string) => {
    // (No autohide: opening a note used to close the drawer, and that kept
    // making the sidebar vanish while you worked.)
    setActiveId(id);
  }, []);

  /* ---------------- tag editing ---------------- */

  const renameTagEverywhere = useCallback((from: string, to: string) => {
    const clean = to.replace(/^#+/, "").trim();
    if (!clean || clean === from) return;
    setVault((v) => ({
      ...v,
      notes: v.notes.map((n) => {
        if (n.locked) return n;
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
        if (n.locked) return n;
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

  /* ---------------- note clipboard ---------------- */

  /** Ctrl+C with nothing selected: remember the open note (and the clipboard). */
  const copyActiveNote = useCallback(() => {
    if (!activeNote) return;
    copiedRef.current = { title: activeNote.title || "Untitled", content: activeNote.content };
    try {
      void navigator.clipboard?.writeText(activeNote.content);
    } catch {
      /* the in-app copy still works without clipboard access */
    }
    setFlash("Copied");
  }, [activeNote]);

  /** Ctrl+V outside a field: a brand-new note from the last Ctrl+C. */
  const pasteNote = useCallback(() => {
    const src = copiedRef.current;
    if (!src) return;
    const note: Note = {
      id: uid(),
      title: `${src.title} copy`,
      autoTitle: false,
      content: src.content,
      folderId: activeNote?.folderId ?? null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setVault((v) => ({ ...v, notes: [note, ...v.notes] }));
    setActiveId(note.id);
    setFlash("Pasted");
  }, [activeNote?.folderId]);

  /** Ctrl+X outside a field: ask before deleting the note that is open. */
  const requestDeleteNote = useCallback(() => {
    const note = vault.notes.find((n) => n.id === activeId);
    if (!note || note.locked) return;
    setConfirmDeleteId(note.id);
  }, [vault.notes, activeId]);

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    // Native cut/copy/paste must keep working inside the editor, so the
    // note-level Ctrl+X/C/V shortcuts only run when focus is outside a field.
    const inField = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      return !!el && !!el.closest("input, textarea, [contenteditable='true']");
    };
    const hasSelection = () => {
      const sel = window.getSelection?.();
      return !!sel && sel.toString().length > 0;
    };

    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();

      // Ctrl+N is the browser's "new window" and Ctrl+T its "new tab"; neither
      // can be stopped from a page, so both live on Ctrl+Alt+… instead.
      if (key === "n" || key === "t") {
        if (!e.altKey) return;
        e.preventDefault();
        if (key === "n") createNote("Untitled");
        else setFolderPrompt({ parentId: null });
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
        case ",":
          e.preventDefault();
          setSettingsOpen(true);
          break;
        case ".":
          e.preventDefault();
          setTagsOpen(true);
          break;
        case "x":
          if (inField(e)) return;
          e.preventDefault();
          requestDeleteNote();
          break;
        case "c":
          if (inField(e) || hasSelection()) return;
          e.preventDefault();
          copyActiveNote();
          break;
        case "v":
          if (inField(e)) return;
          e.preventDefault();
          pasteNote();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createNote, toggleSidebar, requestDeleteNote, copyActiveNote, pasteNote]);

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
            onRename={renameItem}
            onDelete={deleteItem}
            onMove={moveNote}
            onShare={setShareId}
            onManageTags={() => setTagsOpen(true)}
            onNewFolderRequest={(parentId) => setFolderPrompt({ parentId })}
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
              title={activeNote && !activeNote.locked ? "Rename this note" : undefined}
              onClick={() => activeNote && !activeNote.locked && setRenamingTitle(true)}
            >
              {activeNote ? activeNote.title : ""}
            </h1>
          )}

          <div className="topbar-right">
            <span className={`saved ${flash ? "is-on" : ""}`}>{flash ?? ""}</span>
            {!account && (
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
            <>
              {activeNote.locked && (
                <div className="note-lock">
                  <Lock aria-hidden /> This note is read-only — it is the welcome page.
                </div>
              )}
              {sourceMode ? (
                <SourceView
                  key={activeNote.id}
                  content={activeNote.content}
                  readOnly={activeNote.locked}
                  onChange={(c) => editContent(activeNote.id, c)}
                />
              ) : (
                <BlockEditor
                  key={activeNote.id}
                  content={activeNote.content}
                  renderContext={renderContext}
                  readOnly={activeNote.locked}
                  onChange={(c) => editContent(activeNote.id, c)}
                  onNavigate={openNoteByTitle}
                  onTagClick={toggleTag}
                />
              )}
            </>
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

      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete note"
          note={`“${vault.notes.find((n) => n.id === confirmDeleteId)?.title || "Untitled"}” will be gone for good.`}
          confirmLabel="Delete note"
          onConfirm={() => {
            deleteItem(confirmDeleteId);
            setConfirmDeleteId(null);
          }}
          onClose={() => setConfirmDeleteId(null)}
        />
      )}

      {folderPrompt && (
        <PromptDialog
          title={folderPrompt.parentId ? "New subfolder" : "New folder"}
          label="Folder name"
          placeholder="Reading, Journal, Work…"
          onConfirm={(name) => {
            createFolder(folderPrompt.parentId, name);
            setFolderPrompt(null);
          }}
          onClose={() => setFolderPrompt(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SourceView({
  content,
  onChange,
  readOnly = false,
}: {
  content: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!readOnly) ref.current?.focus();
  }, [readOnly]);
  if (readOnly) {
    return <pre className="source-view">{content}</pre>;
  }
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

/** Inline rename for the title in the top bar — click it, type, click away.
 *  The field is sized by a hidden mirror so it hugs the text, with an X that
 *  clears it; an empty commit falls back to "Untitled". */
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
    <span className="crumb-input-wrap">
      <span className="crumb-input-measure" aria-hidden>
        {value.trim() || "Untitled"}
      </span>
      <input
        className="crumb-input"
        value={value}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          onDone();
          const clean = value.trim();
          onCommit(clean || "Untitled");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setValue(initial);
            e.currentTarget.blur();
          }
        }}
      />
      {value && (
        <button
          type="button"
          className="crumb-clear"
          title="Clear the title"
          onClick={() => setValue("")}
        >
          <X />
        </button>
      )}
    </span>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
