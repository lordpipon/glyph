"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import type { Block } from "@/lib/blocks";
import {
  editOffsetOf,
  editSourceOf,
  headingPrefix,
  isEmptyMarkerLine,
  kindOf,
  markerForLine,
  serialize,
  splitBlocks,
} from "@/lib/blocks";
import { renderMarkdown, type RenderContext } from "@/lib/markdown";

/**
 * Typora-style hybrid editor.
 *
 * A note is a list of blocks. Each block renders as HTML; clicking one swaps
 * just that block for a textarea holding its raw markdown. Enter splits a block
 * in two, Backspace at offset 0 merges it into the previous one, arrow keys
 * walk between blocks. `onChange` always emits the full markdown, and it
 * round-trips byte-for-byte, so your formatting is never quietly rewritten.
 */

type Props = {
  content: string;
  renderContext: RenderContext;
  onChange: (next: string) => void;
  onNavigate: (noteTitle: string) => void;
  onTagClick: (tag: string) => void;
};

type CaretPoint = { node: Node; offset: number };

/* ------------------------------------------------------------------ *
 * Click point → source offset
 * ------------------------------------------------------------------ */

function caretPointFromEvent(e: { clientX: number; clientY: number }): CaretPoint | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (typeof doc.caretRangeFromPoint === "function") {
    const range = doc.caretRangeFromPoint(e.clientX, e.clientY);
    return range ? { node: range.startContainer, offset: range.startOffset } : null;
  }
  if (typeof doc.caretPositionFromPoint === "function") {
    const pos = doc.caretPositionFromPoint(e.clientX, e.clientY);
    return pos ? { node: pos.offsetNode, offset: pos.offset } : null;
  }
  return null;
}

/** Length of rendered text preceding `node`/`offset`, within `host`. */
function visibleOffsetIn(host: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(host);
  try {
    range.setEnd(node, offset);
  } catch {
    return 0;
  }
  return range.toString().length;
}

/**
 * Walk the markdown source, counting only characters the reader actually sees,
 * until we have consumed `visible` of them. Used so a click in the middle of a
 * rendered sentence lands in the right place in the markdown.
 */
function sourceOffsetAtVisible(source: string, visible: number): number {
  let src = 0;
  let vis = 0;
  while (src < source.length && vis < visible) {
    const rest = source.slice(src);
    let m = /^!\[([^\]]*)\]\([^)]*\)/.exec(rest);
    if (!m) m = /^\[\[([^\]]*)\]\]/.exec(rest);
    if (!m) m = /^\[([^\]]*)\]\([^)]*\)/.exec(rest);
    if (m) {
      vis += m[1].length;
      src += m[0].length;
      continue;
    }
    m = /^(?:```|~~~|\*\*|__|~~|\*|_|`)/.exec(rest);
    if (m) {
      src += m[0].length;
      continue;
    }
    if (src === 0 || source[src - 1] === "\n") {
      m = /^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d{1,9}[.)]\s+)/.exec(rest);
      if (m) {
        src += m[0].length;
        continue;
      }
    }
    if (source[src] === "\\") {
      src += 2;
      continue;
    }
    if (source[src] === "\n") {
      src += 1;
      continue;
    }
    vis += 1;
    src += 1;
  }
  return Math.min(src, source.length);
}

/* ------------------------------------------------------------------ *
 * A single block: rendered, or a textarea when it is the active block
 * ------------------------------------------------------------------ */

type BlockViewProps = {
  block: Block;
  isEditing: boolean;
  context: RenderContext;
  onActivate: (block: Block, sourceOffset: number) => void;
  onDeactivate: () => void;
  registerTextarea: (id: string, el: HTMLTextAreaElement | null) => void;
  handleKey: (block: Block, e: KeyboardEvent<HTMLTextAreaElement>) => boolean;
  onInput: (block: Block, value: string) => void;
  onNavigate: (noteTitle: string) => void;
  onTagClick: (tag: string) => void;
  /** Position in the note, used only to stagger the entrance animation. */
  index: number;
};

const BlockView = memo(function BlockView({
  block,
  isEditing,
  context,
  onActivate,
  onDeactivate,
  registerTextarea,
  handleKey,
  onInput,
  onNavigate,
  onTagClick,
  index,
}: BlockViewProps) {
  const html = useMemo(
    () => (isEditing ? "" : renderMarkdown(block.source, context)),
    [block.source, context, isEditing],
  );

  const onClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;

      const wiki = target.closest<HTMLElement>("[data-wikilink]");
      if (wiki) {
        e.preventDefault();
        onNavigate(wiki.dataset.wikilink!);
        return;
      }
      const tag = target.closest<HTMLElement>("[data-tag]");
      if (tag) {
        e.preventDefault();
        onTagClick(tag.dataset.tag!);
        return;
      }
      if (target.closest("a[href]")) return;

      const host = e.currentTarget;
      const point = caretPointFromEvent(e);
      const visible = point && host.contains(point.node)
        ? visibleOffsetIn(host, point.node, point.offset)
        : host.textContent?.length ?? block.source.length;
      onActivate(block, sourceOffsetAtVisible(block.source, visible));
    },
    [block, onActivate, onNavigate, onTagClick],
  );

  // The stagger is capped in CSS, so a long note settles quickly instead of
  // trickling in for a second.
  const entrance = { "--i": index } as CSSProperties;

  if (isEditing) {
    return (
      <div className="blk blk-editing" style={entrance}>
        <textarea
          ref={(el) => registerTextarea(block.id, el)}
          className="blk-input"
          value={editSourceOf(block)}
          rows={1}
          spellCheck={false}
          placeholder="Write something…"
          onChange={(e) => onInput(block, e.target.value)}
          onKeyDown={(e) => handleKey(block, e)}
          onBlur={onDeactivate}
        />
      </div>
    );
  }

  return (
    <div
      className={`blk blk-${block.kind}`}
      style={entrance}
      onClick={onClick}
      // Content comes from the user's own notes; raw HTML is escaped on render.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

/* ------------------------------------------------------------------ *
 * Editor
 * ------------------------------------------------------------------ */

export default function BlockEditor({
  content,
  renderContext,
  onChange,
  onNavigate,
  onTagClick,
}: Props) {
  const [blocks, setBlocks] = useState<Block[]>(() => splitBlocks(content));
  // Opening a note drops the caret straight into the first block, so typing
  // works the moment a note appears — no click and no Ctrl+E detour. The note
  // identity is the `key` below (`key={activeNote.id}` in App), so the lazy
  // initializer runs again for every note that is opened.
  const [editingId, setEditingId] = useState<string | null>(
    () => splitBlocks(content)[0]?.id ?? null,
  );

  // Mirrors of state that the keyboard handlers need synchronously. They are
  // written from an effect and from `flush`, so handlers never read a stale
  // value between an update and the re-render it triggers.
  const blocksRef = useRef(blocks);
  const emitRef = useRef(onChange);
  const areas = useRef(new Map<string, HTMLTextAreaElement>());
  const focusRequest = useRef<{ id: string; offset: number } | null>(null);
  const emitted = useRef(content);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  useEffect(() => {
    emitRef.current = onChange;
  }, [onChange]);

  // Adopt content replaced from the outside (import, external edit) but never
  // re-split in response to our own emissions — that would drop the caret.
  useEffect(() => {
    if (content === emitted.current) return;
    emitted.current = content;
    setBlocks(splitBlocks(content));
    setEditingId(null);
  }, [content]);

  const flush = useCallback((next: Block[]) => {
    blocksRef.current = next;
    setBlocks(next);
    const text = serialize(next);
    emitted.current = text;
    emitRef.current(text);
  }, []);

  const replaceBlock = useCallback(
    (id: string, source: string): Block[] =>
      blocksRef.current.map((b) => (b.id === id ? { ...b, source, kind: kindOf(source) } : b)),
    [],
  );

  const registerTextarea = useCallback((id: string, el: HTMLTextAreaElement | null) => {
    if (el) areas.current.set(id, el);
    else areas.current.delete(id);
  }, []);

  // Move focus (and restore the requested caret) into the active textarea.
  useLayoutEffect(() => {
    if (!editingId) return;
    const el = areas.current.get(editingId);
    if (!el) return;
    const req = focusRequest.current;
    const offset = req && req.id === editingId ? req.offset : el.value.length;
    focusRequest.current = null;
    el.focus();
    const pos = Math.max(0, Math.min(offset, el.value.length));
    el.setSelectionRange(pos, pos);
  });

  // Textareas grow with their content, the way a document editor should.
  useLayoutEffect(() => {
    areas.current.forEach((el) => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    });
  });

  const activate = useCallback((block: Block, sourceOffset: number) => {
    setEditingId(block.id);
    focusRequest.current = { id: block.id, offset: editOffsetOf(block) + sourceOffset };
  }, []);

  const deactivate = useCallback(() => setEditingId(null), []);

  const focusBlock = useCallback((id: string, offset: number) => {
    setEditingId(id);
    focusRequest.current = { id, offset };
  }, []);

  const onInput = useCallback(
    (block: Block, value: string) => {
      const source = (block.kind === "heading" ? headingPrefix(block.source) : "") + value;
      flush(replaceBlock(block.id, source));
    },
    [flush, replaceBlock],
  );

  const handleKey = useCallback(
    (block: Block, e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
      const ta = e.currentTarget;
      const all = blocksRef.current;
      const index = all.findIndex((b) => b.id === block.id);
      if (index === -1) return false;

      const prefix = block.kind === "heading" ? headingPrefix(block.source) : "";
      const source = prefix + ta.value;
      const caret = ta.selectionStart + prefix.length;
      const collapsed = ta.selectionStart === ta.selectionEnd;
      const newId = () => `b${Math.random().toString(36).slice(2, 9)}`;

      if (e.key === "Escape") {
        e.preventDefault();
        setEditingId(null);
        return true;
      }

      /* walk between blocks with the arrow keys */
      if (collapsed && e.key === "ArrowUp" && ta.selectionStart === 0 && index > 0) {
        const prev = all[index - 1];
        e.preventDefault();
        focusBlock(prev.id, editSourceOf(prev).length);
        return true;
      }
      if (
        collapsed &&
        e.key === "ArrowDown" &&
        ta.selectionStart === ta.value.length &&
        index < all.length - 1
      ) {
        e.preventDefault();
        focusBlock(all[index + 1].id, 0);
        return true;
      }

      /* Ctrl/Cmd + B / I wrap the selection */
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const wrap = e.key === "b" ? "**" : e.key === "i" ? "*" : null;
        if (wrap) {
          e.preventDefault();
          const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd) || "text";
          const next =
            prefix +
            ta.value.slice(0, ta.selectionStart) +
            wrap +
            sel +
            wrap +
            ta.value.slice(ta.selectionEnd);
          flush(replaceBlock(block.id, next));
          focusRequest.current = {
            id: block.id,
            offset: ta.selectionStart + wrap.length + sel.length + wrap.length,
          };
          return true;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const lineStart = source.lastIndexOf("\n", caret - 1) + 1;
        const currentLine = source.slice(lineStart, caret);
        const marker = markerForLine(currentLine);

        /* Enter on an empty list item leaves the list */
        if (isEmptyMarkerLine(currentLine, marker)) {
          const before = source.slice(0, lineStart).replace(/\n+$/, "");
          const after = source.slice(caret).replace(/^\n+/, "");
          const fresh: Block = { id: newId(), source: "", sep: "\n\n", kind: "paragraph" };
          const tail = after
            ? [{ ...block, id: newId(), source: after, sep: block.sep } as Block]
            : [];
          const head = before
            ? [{ ...block, source: before, kind: kindOf(before) } as Block]
            : [];
          const next = [...all.slice(0, index), ...head, fresh, ...tail, ...all.slice(index + 1)];
          flush(next);
          focusBlock(fresh.id, 0);
          return true;
        }

        const left = source.slice(0, caret);
        const right = source.slice(caret);

        /* Enter at the very start opens a fresh block above */
        if (left === "") {
          const fresh: Block = { id: newId(), source: "", sep: "", kind: "paragraph" };
          flush([...all.slice(0, index), fresh, all[index]]);
          focusBlock(fresh.id, 0);
          return true;
        }

        const tail = right.replace(/^\n+/, "");
        const next = [...all];
        next[index] = { ...block, source: left.replace(/\s+$/, ""), kind: kindOf(left), sep: "\n\n" };
        const fresh: Block = {
          id: newId(),
          source: tail === "" ? marker : tail,
          sep: block.sep,
          kind: kindOf(tail === "" ? marker : tail),
        };
        next.splice(index + 1, 0, fresh);
        flush(next);
        focusBlock(fresh.id, 0);
        return true;
      }

      if (e.key === "Backspace" && collapsed && ta.selectionStart === 0) {
        const lineStart = source.lastIndexOf("\n", caret - 1) + 1;
        const currentLine = source.slice(lineStart, caret);
        const marker = markerForLine(currentLine);

        /* Backspace on an empty list item removes the bullet */
        if (isEmptyMarkerLine(currentLine, marker) && block.kind === "list") {
          e.preventDefault();
          const stripped = source.slice(0, lineStart) + source.slice(caret);
          flush(replaceBlock(block.id, stripped));
          focusRequest.current = { id: block.id, offset: lineStart };
          return true;
        }

        if (index > 0) {
          e.preventDefault();
          const prev = all[index - 1];
          const bothInList = prev.kind === "list" && block.kind === "list";
          const joiner = bothInList ? "\n" : "\n\n";
          const merged = prev.source + joiner + source;
          const caretAt = prev.source.length + (block.kind === "heading" ? 0 : joiner.length);
          const next = [...all];
          next[index - 1] = {
            ...prev,
            source: merged,
            kind: kindOf(merged),
            sep: all[index + 1] ? block.sep : prev.sep,
          };
          next.splice(index, 1);
          flush(next);
          focusBlock(prev.id, caretAt);
          return true;
        }
      }

      return false;
    },
    [flush, focusBlock, replaceBlock],
  );

  return (
    <div className="editor-body">
      {blocks.map((block, index) => (
        <BlockView
          key={block.id}
          index={index}
          block={block}
          isEditing={editingId === block.id}
          context={renderContext}
          onActivate={activate}
          onDeactivate={deactivate}
          registerTextarea={registerTextarea}
          handleKey={handleKey}
          onInput={onInput}
          onNavigate={onNavigate}
          onTagClick={onTagClick}
        />
      ))}
    </div>
  );
}