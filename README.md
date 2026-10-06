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
- **Themes and typefaces.** Device (default — brushed space grey), Light (black
  accent), Dark (white accent), Blueish, Reddish, Yellowish, Catppuccin and
  AMOLED, plus seven typefaces with Inter as the default. Dark grounds carry a
  light accent and the light palette a dark one.
- **Share links.** A note can be shared as a single link that carries the
  markdown in its fragment, so it opens on any static host without a database.
  Signed-in readers get their name stamped on the link: **Shared by you**.

## Storage

Everything is kept in `localStorage` under `glyph.vault.v3`, `glyph.prefs.v1`,
`glyph.font` and `glyph.session.v1`. There is no server. The welcome note is
marked as kept and cannot be deleted, and **Settings → Reset notes** brings it
back.

## Accounts

`/signin` and `/register` share one form, and the top bar grows an account menu
with a sign-out button once someone is signed in. Copy `.env.example` to
`.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`; without them the app still runs and the account
pages say the cloud is not connected.

**One-time setup.** Sign in with a username and Settings → Delete account use a
`profiles` table and a couple of SQL functions. Paste `supabase/setup.sql` into
Supabase → SQL Editor and run it once; until then those two features explain
that they are waiting on it, and everything else works.

What the account can do once it exists:

- **Register with a username** (`3–20` letters, numbers, `-` and `_`), an email
  and a password; **sign in with the email *or* the username**.
- **Username** changes whenever you like, with no password checks.
- **Email and password changes** verify your current password first; an email
  change also needs a confirmation link at the new address.
- **Link Google or GitHub** from Settings so the account is never locked to one
  login, and unlink them again as long as another way in remains.
- **Delete the account** for good (it stays a one-way door), or **download all
  your data** — notes, folders and settings as one JSON file — which works with
  or without an account, because the notes are yours either way.

Google and GitHub sign in from a popup. Supabase is the OAuth broker, so going
straight there would drag `supabase.co/auth/v1/authorize` across the address bar
twice — the popup hides that hop and lands on `/auth/callback`, whose only job
is to hand the session over and close itself.

Storing notes in the cloud is not wired yet: signing in changes nothing about
where your notes live, and the copy on the account pages says so.

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
src/app/auth/callback/      where the OAuth popup lands, closes itself
src/app/share/[slug]/page.tsx   read-only page behind a share link
src/components/             editor, sidebar, dialogs, menus, account menu
src/lib/                    storage, markdown, types, share encoding, auth
```
