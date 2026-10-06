"use client";

import { useMemo, useState } from "react";
import { Pen, Trash2, X } from "lucide-react";
import Dialog from "@/components/Dialog";
import { noteHasTag } from "@/lib/markdown";
import type { Note } from "@/lib/types";

/**
 * Tag management. A tag only exists as text inside a note, so everything here
 * edits note content: attach or detach on the note that is open, rename or
 * remove everywhere in the vault.
 */
export default function TagsDialog({
  tagCounts,
  activeNote,
  onRenameTag,
  onDeleteTag,
  onAddTagToNote,
  onRemoveTagFromNote,
  onClose,
}: {
  tagCounts: Map<string, number>;
  activeNote: Note | null;
  onRenameTag: (from: string, to: string) => void;
  onDeleteTag: (tag: string) => void;
  onAddTagToNote: (noteId: string, tag: string) => void;
  onRemoveTagFromNote: (noteId: string, tag: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");

  const tags = useMemo(
    () => [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    [tagCounts],
  );

  const onNote = useMemo(() => {
    if (!activeNote) return [];
    return tags.filter(([tag]) => noteHasTag(activeNote.content, tag)).map(([tag]) => tag);
  }, [activeNote, tags]);

  const clean = draft.trim().replace(/^#+/, "");

  const attach = () => {
    if (!activeNote || !clean) return;
    onAddTagToNote(activeNote.id, clean);
    setDraft("");
  };

  return (
    <Dialog title="Tags" onClose={onClose} width={430}>
      {activeNote && (
        <section className="settings-group">
          <h3 className="panel-title">On “{activeNote.title || "Untitled"}”</h3>

          <div className="chip-row">
            {onNote.length === 0 && <span className="muted-inline">No tags on this note.</span>}
            {onNote.map((tag) => (
              <span key={tag} className="chip">
                #{tag}
                <button
                  title={`Remove #${tag} from this note`}
                  onClick={() => onRemoveTagFromNote(activeNote.id, tag)}
                >
                  <X />
                </button>
              </span>
            ))}
          </div>

          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              attach();
            }}
          >
            <input
              className="field"
              list="glyph-tag-suggestions"
              placeholder="Add a tag to this note"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <datalist id="glyph-tag-suggestions">
              {tags.map(([tag]) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
            <button className="primary-btn" type="submit" disabled={!clean}>
              Add
            </button>
          </form>
        </section>
      )}

      <section className="settings-group">
        <h3 className="panel-title">All tags</h3>
        {tags.length === 0 ? (
          <span className="muted-inline">
            Nothing yet. Type #something in a note and it shows up here.
          </span>
        ) : (
          <ul className="tag-manager">
            {tags.map(([tag, count]) => (
              <TagRow
                key={tag}
                tag={tag}
                count={count}
                onRename={(to) => onRenameTag(tag, to)}
                onDelete={() => onDeleteTag(tag)}
              />
            ))}
          </ul>
        )}
      </section>
    </Dialog>
  );
}

/**
 * One tag with its rename field. The draft lives here, so Escape really does
 * cancel and Enter only ever commits once.
 */
function TagRow({
  tag,
  count,
  onRename,
  onDelete,
}: {
  tag: string;
  count: number;
  onRename: (to: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tag);

  const commit = () => {
    const to = draft.trim().replace(/^#+/, "");
    setEditing(false);
    setDraft(tag);
    if (to && to !== tag) onRename(to);
  };

  return (
    <li>
      {editing ? (
        <form
          className="inline-form tag-rename"
          onSubmit={(e) => {
            e.preventDefault();
            commit();
          }}
        >
          <input
            className="field"
            value={draft}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDraft(tag);
                setEditing(false);
              }
            }}
          />
          <button className="primary-btn" type="submit">
            Save
          </button>
        </form>
      ) : (
        <>
          <span className="tag-manager-name">#{tag}</span>
          <span className="tag-count">{count}</span>
          <button
            className="icon-btn tiny"
            title={`Rename #${tag} everywhere`}
            onClick={() => {
              setDraft(tag);
              setEditing(true);
            }}
          >
            <PencilIcon />
          </button>
          <button
            className="icon-btn tiny danger"
            title={`Delete #${tag} from every note`}
            onClick={onDelete}
          >
            <TrashIcon />
          </button>
        </>
      )}
    </li>
  );
}

function PencilIcon() {
  return <Pen aria-hidden />;
}

function TrashIcon() {
  return <Trash2 aria-hidden />;
}
