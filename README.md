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

Everything is kept in `localStorage` under `glyph.vault.v3`, `glyph.prefs.v1`,
`glyph.font` and `glyph.session.v1`. There is no server. The welcome note is
marked as kept and cannot be deleted, and **Settings → Reset notes** brings it
back.

## Accounts

`/signin` and `/register` are there, and the top bar grows an account menu with
a sign-out button once something is signed in. The cloud half is not connected
yet: `src/lib/auth.ts` validates the form and then says so, with the matching
`supabase.auth.*` call sitting commented out next to it. Copy `.env.example` to
`.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` to switch that on. Until then the sign-in page
offers a clearly labelled local account, which keeps the session real (and the
sign-out button reachable) without pretending the notes moved anywhere.

## Phones, tablets, desktops

The sidebar is a column on wide screens and a drawer with a scrim under 860px,
and picking a note closes it on a phone. Dialogs become bottom sheets under
640px, tables scroll sideways rather than pushing the page wide, touch targets
grow and row actions stay visible on coarse pointers, and
`prefers-reduced-motion` turns the animations off.

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
src/app/signin/page.tsx     account pages (with /register), one shared form
src/app/share/[slug]/page.tsx   read-only page behind a share link
src/components/             editor, sidebar, dialogs, menus, account menu
src/lib/                    storage, markdown, types, share encoding, auth
```
