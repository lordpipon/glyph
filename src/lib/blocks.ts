/**
 * A note is stored as raw markdown. For the Typora-style editing experience we
 * split that markdown into blocks and render each block independently.
 *
 * Blocks keep the exact whitespace that followed them (`sep`) so that
 * `serialize(splitBlocks(src)) === src`. That round-trip guarantee is what lets
 * us freely split, merge and reorder blocks while editing without ever
 * rewriting the user's formatting.
 */

export type BlockKind =
  | "heading"
  | "paragraph"
  | "list"
  | "quote"
  | "code"
  | "hr"
  | "table";

export type Block = {
  id: string;
  kind: BlockKind;
  /** raw markdown for this block */
  source: string;
  /** whitespace that followed the block in the original document */
  sep: string;
};

let counter = 0;

export function newBlockId(): string {
  counter += 1;
  return `b${counter.toString(36)}`;
}

const FENCE = /^\s*(?:```|~~~)/;

export function lineKind(line: string): BlockKind {
  if (FENCE.test(line)) return "code";
  if (/^\s{0,3}#{1,6}\s/.test(line)) return "heading";
  if (/^\s{0,3}([-*_])\s*(?:\1\s*){2,}$/.test(line)) return "hr";
  if (/^\s*(?:[-*+]|\d{1,9}[.)])\s+/.test(line)) return "list";
  if (/^\s*>/.test(line)) return "quote";
  if (line.includes("|")) return "table";
  return "paragraph";
}

export function kindOf(source: string): BlockKind {
  return lineKind(source.split("\n")[0] ?? "");
}

export function makeBlock(source: string, sep = ""): Block {
  return { id: newBlockId(), kind: kindOf(source), source, sep };
}

/** Split markdown into blocks on blank lines, staying fence-aware. */
export function splitBlocks(src: string): Block[] {
  const lines = src.split("\n");
  const out: Block[] = [];
  const cur: string[] = [];
  let fence: string | null = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const blank = line.trim() === "";

    if (blank && fence === null) {
      let j = i;
      while (j < lines.length && lines[j].trim() === "") j += 1;
      const sep = lines.slice(i, j).join("\n") + "\n";
      if (cur.length) {
        out.push(makeBlock(cur.join("\n"), sep));
        cur.length = 0;
      }
      i = j;
      continue;
    }

    cur.push(line);
    if (fence === null) {
      if (FENCE.test(line)) fence = line.trim().slice(0, 3);
    } else if (FENCE.test(line) && line.trim().startsWith(fence)) {
      fence = null;
    }
    i += 1;
  }

  if (cur.length) out.push(makeBlock(cur.join("\n"), ""));
  if (out.length === 0) out.push(makeBlock(""));
  return out;
}

export function serialize(blocks: Block[]): string {
  return blocks.map((b) => b.source + b.sep).join("");
}

/* ------------------------------------------------------------------ *
 * Heading helpers — like Typora, we hide the `#` markers while you are
 * editing a heading, so we split them off into a prefix/suffix pair.
 * ------------------------------------------------------------------ */

const HEADING_MARKER = /^\s*#{1,6}\s+/;

export function headingPrefix(source: string): string {
  const m = HEADING_MARKER.exec(source);
  return m ? m[0] : "";
}

export function editSourceOf(block: Block): string {
  return block.kind === "heading"
    ? block.source.slice(headingPrefix(block.source).length)
    : block.source;
}

/** Offset, in the textarea's value space, at which the text of a block starts. */
export function editOffsetOf(block: Block): number {
  return block.kind === "heading" ? headingPrefix(block.source).length : 0;
}

/* ------------------------------------------------------------------ *
 * List / quote marker continuation, used when pressing Enter.
 * ------------------------------------------------------------------ */

const LIST_MARKER = /^(\s*)(?:([-*+])|(\d{1,9})([.)]))(\s*)/;

export function markerForLine(line: string): string {
  const quote = /^(\s*(?:>\s?)+)/.exec(line);
  if (quote) return quote[1];
  const list = LIST_MARKER.exec(line);
  if (list) {
    const bullet = list[2] ? `${list[2]} ` : `${list[3] === "1" ? 1 : 1}${list[4]} `;
    return `${list[1]}${bullet}`;
  }
  return "";
}

export function isEmptyMarkerLine(line: string, marker: string): boolean {
  return marker !== "" && line.trim() === marker.trim();
}

/** Used for the outline: heading level + text for each heading block. */
export function outlineOf(content: string): { level: number; text: string; index: number }[] {
  return splitBlocks(content).reduce<{ level: number; text: string; index: number }[]>(
    (acc, block, index) => {
      if (block.kind === "heading") {
        const m = /^(#{1,6})\s+(.*)$/.exec(block.source.split("\n")[0]);
        if (m) acc.push({ level: m[1].length, text: m[2].replace(/[*_`]/g, ""), index });
      }
      return acc;
    },
    [],
  );
}

export function wordCount(content: string): number {
  const text = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+.*$/gm, " ")
    .replace(/[*_`>#|\[\]()~-]/g, " ");
  const words = text.split(/\s+/).filter(Boolean);
  return words.length;
}