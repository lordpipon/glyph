# Glyph

A quiet markdown editor that feels like you are typing straight into the finished
page. Notes live in your browser, nothing else is involved.

## What it does

- **Live editing.** Click into the text and the markdown syntax hides itself
  while you type. `Ctrl + E` shows the raw source for the note you are in.
- **Wikilinks.** `[[Roadmap]]` opens (or creates) another note.
- **Tags.** Type `#anything` and it shows up in the sidebar. The manager beside
  the **Tags** heading renames, adds, removes and attaches them.
- **Folders.** Nest as deep as you like; notes move between them from the row
  menu.
- **Themes and typefaces.** Device (default), Light, Dark, Aluminium, Blueish,
  Reddish, Yellowish, Catppuccin and AMOLED, plus seven typefaces with Inter as
  the default. Dark grounds carry a light accent and the light palette a dark
  one.
- **Share links.** A note can be shared as a single link that carries the
  markdown in its fragment, so it opens on any static host without a database.

## Storage

Everything is kept in `localStorage` under `glyph.vault.v3`, `glyph.prefs.v1`
and `glyph.font`. There is no account and no server. The welcome note is marked
as kept and cannot be deleted, and **Settings → Reset notes** brings it back.

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm run start   # serve the production build
npm run lint
```

Deploying to Vercel needs nothing special — the app is a static, client-rendered
page, so `npm run build` is all it takes.

## Layout

```
src/app/page.tsx            mounts the client-only editor
src/app/share/[slug]/page.tsx   read-only page behind a share link
src/components/             editor, sidebar, dialogs, menus
src/lib/                    storage, markdown, types, share encoding
```
