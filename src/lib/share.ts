/**
 * Share links, without a backend.
 *
 * The note itself is encoded into the fragment of a `/share/<slug>.md` URL, so
 * the link carries the document and can be opened on any device. The path stays
 * readable, the payload lives after the `#`.
 */

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

export function encodeShare(markdown: string, title: string): string {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify({ t: title, m: markdown })));
  return `${location.origin}/share/${slug(title)}.md#${payload}`;
}

/** `null` when the fragment is missing or was tampered with. */
export function decodeShare(hash: string): { title: string; markdown: string } | null {
  const raw = hash.replace(/^#/, "");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(raw))) as {
      t?: string;
      m?: string;
    };
    if (typeof parsed.m !== "string") return null;
    return { title: typeof parsed.t === "string" ? parsed.t : "Shared note", markdown: parsed.m };
  } catch {
    return null;
  }
}

function slug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "note"
  );
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}