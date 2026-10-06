"use client";

import { useMemo, useState } from "react";
import {
  ChevronRight,
  FilePlus2,
  FileText,
  Folder as FolderGlyph,
  FolderInput,
  FolderPlus,
  Inbox,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Share2,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Dialog, { PromptDialog } from "@/components/Dialog";
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
  onShare: (id: string) => void;
  onManageTags: () => void;
  /** Drawer only: set while it slides away, so closing is animated too. */
  exiting?: boolean;
};

type MenuKey = `note:${string}` | `folder:${string}`; /* which row's menu is open */

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
  onShare,
  onManageTags,
  exiting = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [menuKey, setMenuKey] = useState<MenuKey | null>(null);
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

  const openMenu = (key: MenuKey) => {
    setMenuKey(key);
  };

  return (
    <aside className={exiting ? "sidebar is-closing" : "sidebar"}>
      <div className="sidebar-top">
        <h2 className="brand">Glyph</h2>
        <div className="toolbar">
          <button className="icon-btn" onClick={() => onCreateNote(null)} title="New note (Ctrl+Alt+N)">
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
            <DropdownMenu
              key={row.folder.id}
              open={menuKey === `folder:${row.folder.id}`}
              onOpenChange={(open) =>
                setMenuKey(open ? `folder:${row.folder.id}` : null)
              }
            >
              <div
                className="tree-row folder-row"
                onContextMenu={(e) => {
                  e.preventDefault();
                  openMenu(`folder:${row.folder.id}`);
                }}
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
                  <DropdownMenuTrigger
                    render={
                      <button className="icon-btn tiny" title="Folder menu">
                        <DotsIcon />
                      </button>
                    }
                  />
                </div>
              </div>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onCreateNote(row.folder.id)}>
                  <FilePlus2 /> New note inside
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setNewFolderIn(row.folder.id)}>
                  <FolderPlus /> New subfolder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setRenamingId(row.folder.id)}>
                  <Pencil /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => onDelete(row.folder.id)}
                >
                  <Trash2 /> Delete “{row.folder.name}”
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu
              key={row.note.id}
              open={menuKey === `note:${row.note.id}`}
              onOpenChange={(open) =>
                setMenuKey(open ? `note:${row.note.id}` : null)
              }
            >
              <div
                className={`tree-row note-row ${activeId === row.note.id ? "is-active" : ""}`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  openMenu(`note:${row.note.id}`);
                }}
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
                  <DropdownMenuTrigger
                    render={
                      <button className="icon-btn tiny" title="Note menu">
                        <DotsIcon />
                      </button>
                    }
                  />
                </div>
              </div>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setRenamingId(row.note.id)}>
                  <Pencil /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onShare(row.note.id)}>
                  <Share2 /> Share
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setMoveTarget(row.note.id)}>
                  <FolderInput /> Move to…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {row.note.locked ? (
                  <DropdownMenuItem disabled>
                    <Lock /> Kept, cannot be deleted
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => onDelete(row.note.id)}
                  >
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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
  return <Plus aria-hidden />;
}

function FolderPlusIcon() {
  return <FolderPlus aria-hidden />;
}

function FolderIcon() {
  return <FolderGlyph aria-hidden />;
}

function InboxIcon() {
  return <Inbox aria-hidden />;
}

function FileIcon() {
  return <FileText aria-hidden />;
}

function ChevronIcon({ open }: { open: boolean }) {
  return <ChevronRight aria-hidden className={`chevron ${open ? "is-open" : ""}`} />;
}

function DotsIcon() {
  return <MoreHorizontal aria-hidden />;
}

function SearchIcon() {
  return <Search aria-hidden className="search-icon" />;
}

function XIcon() {
  return <X aria-hidden />;
}

function SlidersIcon() {
  return <SlidersHorizontal aria-hidden />;
}
