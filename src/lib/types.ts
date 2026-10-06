export type Note = {
  id: string;
  title: string;
  /** true while the note still uses a generated title (updates from the first heading) */
  autoTitle: boolean;
  /** set on the welcome note: it stays put and cannot be deleted */
  locked?: boolean;
  content: string;
  folderId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
};

export type Vault = {
  notes: Note[];
  folders: Folder[];
};

/**
 * "system" is Device: a fixed brushed-space-grey palette (the "aluminium" look)
 * — it no longer follows the operating system. Every other value is a fixed
 * palette: dark grounds carry a light accent, the light palette a dark one.
 */
export type Theme =
  | "system"
  | "light"
  | "dark"
  | "aluminium" // legacy stored value from before the retheme, treated as Device
  | "blue"
  | "red"
  | "yellow"
  | "catppuccin"
  | "amoled";

export type FontId =
  | "inter"
  | "figtree"
  | "manrope"
  | "grotesk"
  | "plex"
  | "literata"
  | "newsreader";

export const FONTS: { id: FontId; name: string; note: string }[] = [
  { id: "inter", name: "Inter", note: "Neutral, highly legible" },
  { id: "figtree", name: "Figtree", note: "Closest to Google Sans" },
  { id: "manrope", name: "Manrope", note: "Geometric, friendly" },
  { id: "grotesk", name: "Space Grotesk", note: "Technical character" },
  { id: "plex", name: "IBM Plex Sans", note: "Engineered, formal" },
  { id: "literata", name: "Literata", note: "Warm serif for reading" },
  { id: "newsreader", name: "Newsreader", note: "Editorial serif" },
];

export const THEMES: { id: Theme; name: string; note: string }[] = [
  { id: "system", name: "Device", note: "Brushed space grey, no colour at all" },
  { id: "light", name: "Light", note: "Pale ground, black accent" },
  { id: "dark", name: "Dark", note: "Ink ground, white accent" },
  { id: "blue", name: "Blueish", note: "Cold blues on deep navy" },
  { id: "red", name: "Reddish", note: "Warm rose on deep brown" },
  { id: "yellow", name: "Yellowish", note: "Amber on dark olive" },
  { id: "catppuccin", name: "Catppuccin", note: "Mocha, soft pastel" },
  { id: "amoled", name: "AMOLED", note: "True black, silver accent" },
];
