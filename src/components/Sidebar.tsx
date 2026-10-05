"use client";

import { useMemo, useState } from "react";
import Dialog, { PromptDialog } from "@/components/Dialog";
import Menu, { type MenuEntry } from "@/components/Menu";
import type { Folder, Note } from "@/lib/types";

type Props = {
  notes: Note[];
  folders: Folder[];
  activeId: string | null;
  tagFilter: string | null;
  tagCounts: Map<string, number>;
  onOpen: (id: string) => void;
  onToggleTag: (tag: string | null) => void;
  onCreateNote: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null, name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, folderId: string | null) => void;
  onDownload: (id: string) => void;
  onShare: (id: string) => void;
  onManageTags: () => void;
};

type MenuState = { x: number; y: number; kind: "note" | "folder"; id: string } | null;

const INDENT = 14;

export default function Sidebar({
  notes,
  folders,
  activeId,
  tagFilter,
  tagCounts,
  onOpen,
  onToggleTag,
  onCreateNote,
  onCreateFolder,
  onRename,
  onDelete,
  onMove,
  onDownload,
  onShare,
  onManageTags,
}: Props) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [newFolderIn, setNewFolderIn] = useState<string | null | undefined>(undefined);

  const q = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!q) return null;
    return new Set(
      notes
        .filter(
          (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
        )
        .map((n) => n.id),
    );
  }, [q, notes]);

  const visibleIds = useMemo(() => {
    if (!matches && !tagFilter) return null;
    const ids = new Set<string>();
    for (const note of notes) {
      if (matches && !matches.has(note.id)) continue;
      if (tagFilter && !note.content.includes(`#${tagFilter}`)) continue;
      ids.add(note.id);
    }
    return ids;
  }, [matches, tagFilter, notes]);

  const rows = useMemo(() => {
    type Row =
      | { kind: "folder"; folder: Folder; depth: number }
      | { kind: "note"; note: Note; depth: number };
    const out: Row[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const folder of folders
        .filter((f) => f.parentId === parentId)
        .sort((a, b) => a.name.localeCompare(b.name))) {
        out.push({ kind: "folder", folder, depth });
        if (!collapsed.has(folder.id)) walk(folder.id, depth + 1);
      }
      const here: Note[] = notes
        .filter((n) => n.folderId === parentId && (!visibleIds || visibleIds.has(n.id)))
        .sort((a, b) => (a.title || "Untitled").localeCompare(b.title || "Untitled"));
      for (const note of here) {
        out.push({ kind: "note", note, depth });
      }
    };
    walk(null, 0);
    return out;
  }, [collapsed, folders, notes, visibleIds]);

  const tags = useMemo(
    () => [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    [tagCounts],
  );

  const openMenu = (
    e: { clientX: number; clientY: number; preventDefault: () => void },
    kind: "note" | "folder",
    id: string,
  ) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, kind, id });
  };

  const menuEntries: MenuEntry[] = useMemo(() => {
    if (!menu) return [];

    if (menu.kind === "folder") {
      const folderId = menu.id;
      const folder = folders.find((f) => f.id === folderId);
      return [
        { kind: "item", label: "New note inside", onSelect: () => onCreateNote(folderId) },
        { kind: "item", label: "New subfolder", onSelect: () => setNewFolderIn(folderId) },
        { kind: "separator" },
        { kind: "item", label: "Rename", onSelect: () => setRenamingId(folderId) },
        {
          kind: "item",
          label: `Delete “${folder?.name ?? ""}”`,
          danger: true,
          onSelect: () => onDelete(folderId),
        },
      ];
    }

    const noteId = menu.id;
    const note = notes.find((n) => n.id === noteId);
    const entries: MenuEntry[] = [
      { kind: "item", label: "Rename", onSelect: () => setRenamingId(noteId) },
      { kind: "item", label: "Download", onSelect: () => onDownload(noteId) },
      { kind: "item", label: "Share", onSelect: () => onShare(noteId) },
      { kind: "item", label: "Move to…", onSelect: () => setMoveTarget(noteId) },
    ];
    // The welcome note has no delete entry — it is the one note that stays.
    if (note?.locked) {
      entries.push(
        { kind: "separator" },
        { kind: "item", label: "Kept, cannot be deleted", onSelect: () => {}, disabled: true },
      );
    } else {
      entries.push(
        { kind: "separator" },
        { kind: "item", label: "Delete", danger: true, onSelect: () => onDelete(noteId) },
      );
    }
    return entries;
  }, [menu, folders, notes, onCreateNote, onDelete, onDownload, onShare]);

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <h2 className="brand">Glyph</h2>
        <div className="toolbar">
          <button className="icon-btn" onClick={() => onCreateNote(null)} title="New note (Ctrl+N)">
            <PlusIcon />
          </button>
          <button
            className="icon-btn"
            onClick={() => setNewFolderIn(null)}
            title="New folder"
          >
            <FolderPlusIcon />
          </button>
        </div>
      </div>

      <div className="search-row">
        <SearchIcon />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes"
          spellCheck={false}
        />
        {query && (
          <button className="icon-btn tiny" onClick={() => setQuery("")} title="Clear search">
            <XIcon />
          </button>
        )}
      </div>

      {tagFilter && (
        <div className="filter-chip">
          <span>tagged</span>
          <strong>#{tagFilter}</strong>
          <button className="icon-btn tiny" onClick={() => onToggleTag(null)} title="Remove filter">
            <XIcon />
          </button>
        </div>
      )}

      <nav className="tree" aria-label="Notes">
        {rows.length === 0 && <p className="tree-empty">Nothing here.</p>}
        {rows.map((row) =>
          row.kind === "folder" ? (
            <div
              key={row.folder.id}
              className="tree-row folder-row"
              onContextMenu={(e) => openMenu(e, "folder", row.folder.id)}
            >
              <button
                className="tree-item folder"
                style={{ paddingLeft: 6 + row.depth * INDENT }}
                onClick={() =>
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (next.has(row.folder.id)) next.delete(row.folder.id);
                    else next.add(row.folder.id);
                    return next;
                  })
                }
                aria-expanded={!collapsed.has(row.folder.id)}
              >
                <ChevronIcon open={!collapsed.has(row.folder.id)} />
                {renamingId === row.folder.id ? (
                  <RenameInput
                    initial={row.folder.name}
                    onCommit={(v) => onRename(row.folder.id, v)}
                    onDone={() => setRenamingId(null)}
                  />
                ) : (
                  <span className="label">{row.folder.name}</span>
                )}
              </button>
              <div className="row-actions">
                <button
                  className="icon-btn tiny"
                  title="New note inside"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateNote(row.folder.id);
                  }}
                >
                  <PlusIcon />
                </button>
                <button
                  className="icon-btn tiny"
                  title="Menu"
                  onClick={(e) => {
                    e.stopPropagation();
                    openMenu(e, "folder", row.folder.id);
                  }}
                >
                  <DotsIcon />
                </button>
              </div>
            </div>
          ) : (
            <div
              key={row.note.id}
              className={`tree-row note-row ${activeId === row.note.id ? "is-active" : ""}`}
              onContextMenu={(e) => openMenu(e, "note", row.note.id)}
            >
              <button
                className="tree-item note"
                style={{ paddingLeft: 6 + row.depth * INDENT }}
                onClick={() => onOpen(row.note.id)}
                title={row.note.title}
              >
                <FileIcon />
                {renamingId === row.note.id ? (
                  <RenameInput
                    initial={row.note.title}
                    onCommit={(v) => onRename(row.note.id, v)}
                    onDone={() => setRenamingId(null)}
                  />
                ) : (
                  <span className="label">{row.note.title || "Untitled"}</span>
                )}
              </button>
              <div className="row-actions">
                <button
                  className="icon-btn tiny"
                  title="Menu"
                  onClick={(e) => {
                    e.stopPropagation();
                    openMenu(e, "note", row.note.id);
                  }}
                >
                  <DotsIcon />
                </button>
              </div>
            </div>
          ),
        )}
      </nav>

      <div className="tags">
        <div className="tags-head">
          <h3 className="panel-title">Tags</h3>
          <button className="icon-btn tiny" onClick={onManageTags} title="Manage tags">
            <SlidersIcon />
          </button>
        </div>
        {tags.length === 0 ? (
          <p className="muted-inline">No tags yet. Type #something in a note.</p>
        ) : (
          <div className="tag-cloud">
            {tags.map(([tag, count]) => (
              <button
                key={tag}
                className={`tag ${tagFilter === tag ? "is-active" : ""}`}
                onClick={() => onToggleTag(tagFilter === tag ? null : tag)}
              >
                #{tag}
                <span className="tag-count">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {menu && <Menu x={menu.x} y={menu.y} entries={menuEntries} onClose={() => setMenu(null)} />}

      {moveTarget && (
        <Dialog title="Move note" onClose={() => setMoveTarget(null)} width={340}>
          <div className="move-list">
            <button
              className="move-row"
              onClick={() => {
                onMove(moveTarget, null);
                setMoveTarget(null);
              }}
            >
              <InboxIcon /> Inbox <em>top level</em>
            </button>
            {folders
              .filter((f) => !f.parentId)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((folder) => (
                <button
                  key={folder.id}
                  className="move-row"
                  onClick={() => {
                    onMove(moveTarget, folder.id);
                    setMoveTarget(null);
                  }}
                >
                  <FolderIcon /> {folder.name}
                </button>
              ))}
          </div>
        </Dialog>
      )}

      {newFolderIn !== undefined && (
        <PromptDialog
          title={newFolderIn ? "New subfolder" : "New folder"}
          label="Folder name"
          placeholder="Reading, Journal, Work…"
          onConfirm={(name) => {
            onCreateFolder(newFolderIn, name);
            setNewFolderIn(undefined);
          }}
          onClose={() => setNewFolderIn(undefined)}
        />
      )}
    </aside>
  );
}

/* ------------------------------------------------------------------ */

function RenameInput({
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
      className="rename-input"
      value={value}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onClick={(e) => e.stopPropagation()}
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

function FolderPlusIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path d="M1.75 4.25h4l1.5 1.75h6.99v6a1 1 0 01-1 1H2.75a1 1 0 01-1-1z" />
      <path d="M8 8v3.5M6.25 9.75h3.5" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path d="M1.75 4.25h4l1.5 1.75h6.99v6a1 1 0 01-1 1H2.75a1 1 0 01-1-1z" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path d="M2 9.5h3l1 2h4l1-2h3M2 9.5l1.8-5.3a1 1 0 011-.7h6.4a1 1 0 011 .7L14 9.5v3a1 1 0 01-1 1H3a1 1 0 01-1-1z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path d="M4 2.5h4.5L12 6v7.5H4z" />
      <path d="M8.5 2.5V6H12" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={`chevron ${open ? "is-open" : ""}`}
    >
      <path d="M6.5 4l4 4-4 4" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <circle cx="4" cy="8" r="1.15" />
      <circle cx="8" cy="8" r="1.15" />
      <circle cx="12" cy="8" r="1.15" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="search-icon">
      <circle cx="7" cy="7" r="4.25" />
      <path d="M10.2 10.2L14 14" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path d="M2.5 5h11M2.5 11h11" />
      <circle cx="6" cy="5" r="1.6" />
      <circle cx="10.5" cy="11" r="1.6" />
    </svg>
  );
}
