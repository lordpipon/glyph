import { FONTS, type FontId, type Theme, type Vault } from "./types";

/**
 * v3 made the welcome note undeletable and gave the seed three tags. Bumping
 * the key drops any vault written by an older build, which is safe here: the
 * notes only ever lived in this browser and a fresh vault is one click away in
 * the settings.
 */
const KEY = "glyph.vault.v3";
const PREFS_KEY = "glyph.prefs.v1";
const FONT_KEY = "glyph.font";

export function loadVault(): Vault | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Vault;
    if (!Array.isArray(parsed?.notes) || !Array.isArray(parsed?.folders)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveVault(vault: Vault): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(vault));
  } catch {
    // Storage full or blocked (private mode): the editor keeps working in
    // memory, it just will not survive a reload.
  }
}

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaultPrefs;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      sidebarOpen: parsed.sidebarOpen ?? defaultPrefs.sidebarOpen,
      theme: isTheme(parsed.theme) ? parsed.theme : defaultPrefs.theme,
      lastNoteId: typeof parsed.lastNoteId === "string" ? parsed.lastNoteId : null,
    };
  } catch {
    return defaultPrefs;
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function loadFont(): FontId {
  try {
    const v = localStorage.getItem(FONT_KEY);
    if (v && FONTS.some((f) => f.id === v)) return v as FontId;
  } catch {
    /* ignore */
  }
  return "inter";
}

export function saveFont(font: FontId): void {
  try {
    localStorage.setItem(FONT_KEY, font);
  } catch {
    /* ignore */
  }
}

/** "system" collapses to whichever palette the device is asking for. */
export function appliedTheme(theme: Theme): Exclude<Theme, "system"> {
  if (theme !== "system") return theme;
  return prefersLight() ? "light" : "dark";
}

export function prefersLight(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-color-scheme: light)").matches
  );
}

export type Prefs = {
  sidebarOpen: boolean;
  /** Device by default, so the app matches whatever the reader is using. */
  theme: Theme;
  lastNoteId: string | null;
};

const defaultPrefs: Prefs = { sidebarOpen: true, theme: "system", lastNoteId: null };

function isTheme(value: unknown): value is Theme {
  return (
    value === "system" ||
    value === "light" ||
    value === "dark" ||
    value === "aluminium" ||
    value === "blue" ||
    value === "red" ||
    value === "yellow" ||
    value === "catppuccin" ||
    value === "amoled"
  );
}

export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}