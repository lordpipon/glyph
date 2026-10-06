import type { Vault } from "./types";

const T = 1767225600000; // fixed timestamp so the server and client agree

const welcome = `# Welcome to Glyph

A small markdown editor that feels like you are typing straight into the finished
page. Your notes are saved in this browser as you type, and this one note cannot
be deleted or edited — it is the signpost back to how everything works.

# How editing works

Click anywhere in the text and start typing. Markdown syntax hides itself while
you write and comes back when you click away.

Formatting you already know:

- **bold**, *italic*, ~~strikethrough~~, \`inline code\`
- [[Roadmap]] links between notes — follow one that does not exist yet and it is
  created on the spot
- > blockquotes, tables, fenced code, task lists
- \`#tags\`, which light up in the list on the left

Three tags come with the editor so the sidebar has something to show: #ideas for
loose thoughts, #reading for things to read later, and #forlater for anything
waiting on a decision. Rename, add or drop them with the button next to
**Tags**, and attach them to whichever note is open.

## Shortcuts

| Keys | Action |
| --- | --- |
| \`Ctrl + P\` | Quick switcher |
| \`Ctrl + Alt + N\` | New note |
| \`Ctrl + Alt + T\` | New folder |
| \`Ctrl + B\` | Toggle sidebar |
| \`Ctrl + E\` | Read the raw markdown |
| \`Ctrl + X\` | Delete the open note |
| \`Ctrl + C\` | Copy the open note |
| \`Ctrl + V\` | Paste a copy of it as a new note |
| \`Ctrl + ,\` | Open settings |
| \`Ctrl + .\` | Manage tags |

# Making it yours

The gear in the top right is the whole settings panel: the typeface Glyph writes
and reads in, and the theme — device, light, dark, blueish, reddish, yellowish,
Catppuccin or AMOLED (device now matches the dark look). Dark grounds get a
light accent and the light one a dark accent, so nothing disappears either way.

Right click any note or folder for its menu, or use the three dots on the row.
Every note can be shared as a link that anyone can open in a browser.

An account and syncing notes across devices are on the way — until then your
notes live in this browser only.

If you ever want to start over, **Reset notes** in the settings wipes this
browser's notes and brings this page back.`;

export function seedVault(): Vault {
  return {
    folders: [],
    notes: [
      {
        id: "n-welcome",
        title: "Welcome to Glyph",
        autoTitle: false,
        locked: true,
        folderId: null,
        createdAt: T,
        updatedAt: T,
        content: welcome,
      },
    ],
  };
}
