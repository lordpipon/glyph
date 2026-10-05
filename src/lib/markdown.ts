import { Marked, type Tokens } from "marked";
import type { TokenizerAndRendererExtension } from "marked";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type RenderContext = {
  /** lower-cased note titles that currently exist, used to resolve links */
  existing: Set<string>;
  /** title of the note being rendered, so self-links get their own style */
  currentTitle: string;
};

/** Populated immediately before each parse by `renderMarkdown`. */
let ctx: RenderContext = { existing: new Set(), currentTitle: "" };

const marked = new Marked({ gfm: true, breaks: true });

const extensions: TokenizerAndRendererExtension[] = [
  {
    name: "wikilink",
    level: "inline",
    start(src) {
      const i = src.indexOf("[[");
      return i === -1 ? undefined : i;
    },
    tokenizer(src) {
      const m = /^\[\[([^\[\]\n|#]+?)(?:#([^\[\]|\n]+?))?(?:\|([^\[\]\n]+?))?\]\]/.exec(src);
      if (!m) return undefined;
      const target = m[1].trim();
      if (!target) return undefined;
      return {
        type: "wikilink",
        raw: m[0],
        target,
        hash: (m[2] ?? "").trim(),
        alias: (m[3] ?? "").trim() || target,
      };
    },
    renderer(token) {
      const { target, hash, alias } = token as typeof token & {
        target: string;
        hash: string;
        alias: string;
      };
      const key = target.toLowerCase();
      const classes = ["wikilink"];
      if (!ctx.existing.has(key)) classes.push("wikilink-missing");
      if (key === ctx.currentTitle.toLowerCase()) classes.push("wikilink-current");
      const label = escapeHtml(alias + (hash ? ` › ${hash}` : ""));
      return `<a class="${classes.join(" ")}" data-wikilink="${escapeHtml(target)}">${label}</a>`;
    },
  },
  {
    name: "hashtag",
    level: "inline",
    start(src) {
      const i = src.indexOf("#");
      return i === -1 ? undefined : i;
    },
    tokenizer(src) {
      const m = /^(\s*)#([\p{L}\p{N}][\p{L}\p{N}_/-]*)/u.exec(src);
      if (!m) return undefined;
      return { type: "hashtag", raw: m[0], tag: m[2] };
    },
    renderer(token) {
      const { raw, tag } = token as typeof token & { raw: string; tag: string };
      return `${raw.slice(0, raw.length - (tag.length + 1))}<a class="hashtag" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</a>`;
    },
  },
];

marked.use({
  extensions,
  renderer: {
    // Raw HTML in a note is displayed as text instead of being injected.
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text);
    },
    link({ href, title, text }: Tokens.Link) {
      const safe = /^(https?:)?\/\//i.test(href) ? href : "#";
      const t = title ? ` title="${escapeHtml(title)}"` : "";
      return `<a href="${escapeHtml(safe)}"${t} target="_blank" rel="noreferrer noopener">${text}</a>`;
    },
  },
});

export function renderMarkdown(source: string, context: RenderContext): string {
  ctx = context;
  return marked.parse(source, { async: false }) as string;
}

/* ------------------------------------------------------------------ *
 * Extraction helpers used by the sidebar, tag pane and backlinks
 * ------------------------------------------------------------------ */

const TAG_RE = /(?:^|\s)#([\p{L}\p{N}][\p{L}\p{N}_/-]*)/gu;

export function tagsIn(content: string): string[] {
  const stripped = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, " ");
  return [...stripped.matchAll(TAG_RE)].map((m) => m[1]);
}

const LINK_RE = /\[\[([^\[\]\n|#]+?)(?:#[^\[\]|\n]+?)?(?:\|[^\[\]\n]+?)?\]\]/g;

export function linksIn(content: string): string[] {
  return [...content.matchAll(LINK_RE)].map((m) => m[1].trim());
}

/* ------------------------------------------------------------------ *
 * Editing tags inside a note's markdown
 * ------------------------------------------------------------------ */

/** Matches one tag, plus the whitespace in front of it so it can be kept. */
function oneTag(tag: string): RegExp {
  return new RegExp(`(^|\\s)#${escapeRegExp(tag)}(?![\\p{L}\\p{N}_/-])`, "gu");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function noteHasTag(content: string, tag: string): boolean {
  return oneTag(tag).test(content);
}

export function addTag(content: string, tag: string): string {
  const clean = tag.replace(/^#+/, "").trim();
  if (!clean || noteHasTag(content, clean)) return content;
  const body = content.replace(/\s+$/, "");
  return body ? `${body} #${clean}` : `#${clean}`;
}

export function removeTag(content: string, tag: string): string {
  return content
    .replace(oneTag(tag), "$1")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n");
}

export function renameTag(content: string, from: string, to: string): string {
  const clean = to.replace(/^#+/, "").trim();
  if (!clean) return content;
  return content.replace(oneTag(from), (_match, lead: string) => `${lead}#${clean}`);
}