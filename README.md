# Cookie Training

A simple exercise journal for tracking training sessions: a public feed and
an editing screen for logging new sessions, backed by [Payload
CMS](https://payloadcms.com) — self-hosted, embedded directly in this
Next.js app, with a SQLite database file (no external services to set up).

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in a real PAYLOAD_SECRET (see comment in the file)
npm run seed                 # creates an admin user + the sample exercises/sessions/media
npm run dev
```

- [http://localhost:3000](http://localhost:3000) — the public feed
- [http://localhost:3000/sessions](http://localhost:3000/sessions) — quick
  add/edit screen (requires login)
- [http://localhost:3000/admin](http://localhost:3000/admin) — the full
  Payload admin: manage exercises, sessions, media, and users directly

`npm run seed` prints the admin login it creates
(`admin@cookietraining.test` / `cookie-admin-pass` by default — override
with `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`). Log in and change the
password before using this for real. It's safe to re-run; it skips content
seeding if any exercise already exists.

## Screens

- **`/` — Training Feed.** Public, no login needed. A chronological,
  filterable feed of sessions. Each session shows its exercise, ratings, a
  trend vs. the previous session for that same exercise, and its media
  (video/photo) items. Video thumbnails play inline on click, with a small
  control bar for pause, slow-motion (1×/0.5×/0.25×), and maximize
  (fullscreen).
- **`/sessions` — Sessions.** Requires login. List of all sessions plus a
  form to add or edit one: exercise, date/time, one row of rating sliders
  per set performed (adding/removing a set updates the rows to match), a
  live session-average readout, sets/reps/rest, notes, and media items
  (upload, caption, reorder, remove). Logged out, this screen shows a gate
  linking to `/admin/login` instead.
- **`/exercises` — Exercises.** Requires login. Read-only list of every
  exercise with its category, focus, and rating dimensions.
- **`/exercises/new` — Add Exercise.** Requires login. Type just the
  exercise's name, then click the sparkle button to have Claude pre-fill
  category, focus, description, and rating dimensions — all still editable
  before saving. Needs `ANTHROPIC_API_KEY` set (see `.env.example`); without
  it, the button shows an error and the field is still fillable by hand.
  Each rating dimension can be picked from a small built-in library
  (`src/lib/rating-library.ts`) for consistent wording across exercises, or
  typed by hand and given a 1–5 descriptive scale via its own sparkle
  button. Capped at 5 dimensions per exercise so the feed's ratings row
  stays readable. Saving returns you to `/exercises`.
- **`/admin` — Payload's admin panel.** The full CMS: edit/delete any
  Exercise, Session, or Media doc directly, manage users.

## Data model

App-level types are in `src/lib/types.ts`; the matching Payload collections
are in `src/collections/`:

- **Exercise** (`src/collections/Exercises.ts`) — the reusable exercise
  definition (name, category, focus, default rating dimensions).
- **Session** (`src/collections/Sessions.ts`) — one instance of performing
  an exercise: a relationship to its exercise, per-set ratings, sets/reps/rest,
  notes, and an array of media items.
- **Media** (`src/collections/Media.ts`) — Payload's built-in upload
  collection; video/image files live here. A session's `media` array field
  references Media docs plus per-item label/notes/order — so sets, videos,
  and photos are all just media items, no separate concept for each.
- **Ratings are stored per set**: a session's `ratingSets` array has one
  entry per set performed, each holding `{ key, score }` pairs (see
  `src/lib/types.ts`'s `RatingSetEntry`). A dimension's label, max, and
  optional 1–5 scale live only on the Exercise
  (`defaultRatings`) — never copied onto the session — so ratings always
  reflect the exercise's current definition. `aggregateRatings()` in
  `src/lib/session-utils.ts` averages each dimension across a session's
  sets and joins in that label/max/scale; this is what the feed and the
  session-level "Overall" score use.
- **Users** (`src/collections/Users.ts`) — Payload's auth collection,
  used for `/admin` and for gating writes from `/sessions`.

## How the app talks to the CMS

Nothing outside `src/lib/data-source.ts`, `src/lib/payload-client.ts`, and
`src/lib/payload-mappers.ts` knows Payload's document shape — every screen
just works with the CMS-agnostic types in `types.ts`. Concretely:

- `payload-client.ts` is a thin `fetch()` wrapper around Payload's
  auto-generated REST API (`/api/exercises`, `/api/sessions`,
  `/api/media`, `/api/users/me`, ...). Requests are same-origin, so the
  browser sends Payload's `payload-token` auth cookie automatically once
  you've logged in at `/admin/login`.
- `payload-mappers.ts` converts between Payload's generated types
  (`src/payload-types.ts`, regenerate with `npm run generate:types` after
  changing a collection) and this app's `Exercise` / `TrainingSession` /
  `MediaItem` types.
- `data-source.ts` is the public API the rest of the app calls:
  `getExercises()`, `getSessions()`, `saveSession()`, `deleteSession()`.
- Reads are public (anyone can view the feed); creating, updating, or
  deleting requires a logged-in user — enforced both in the UI (the
  `/sessions` gate) and, more importantly, in each collection's `access`
  config in `src/collections/`, so it's enforced at the API regardless of
  what the UI does.
- Uploading a file (`src/lib/media-utils.ts`) POSTs it straight to
  `/api/media` and gets back a real asset id + URL, which is then
  referenced when the session is saved.

## Running over plain HTTP vs HTTPS

Deployed on a bare IP with no TLS yet, so a few things are deliberately
tuned for a plain-HTTP origin. Each is driven by
`PAYLOAD_PUBLIC_SERVER_URL`, so adding a domain + TLS and setting that to
the `https://` URL tightens them automatically:

- The auth cookie only gets the `Secure` flag when that URL is `https://`
  (`src/collections/Users.ts`). `Secure` on plain HTTP means the browser
  accepts the cookie but never sends it back, so logins appear to succeed
  and then silently don't stick.
- `serverURL` is left unset in `src/payload.config.ts` so Payload's CSRF
  allowlist stays empty. A non-empty allowlist makes Payload only honour
  the auth cookie when the request carries an `Origin` or `Sec-Fetch-Site`
  header, and plain top-level navigations to `/admin` send neither. The
  `SameSite=Lax` cookie still blocks cross-site writes. See the comment in
  that file before re-adding `serverURL`.
- Avoid browser APIs that require a *secure context* — they're simply
  undefined on a plain-HTTP origin even though they work on `localhost`.
  `crypto.randomUUID()` bit us this way in `src/lib/media-utils.ts`.

## Project layout notes

- Payload renders its own `<html>`/`<body>` for `/admin`, so the app is
  split into two Next.js route groups, each with its own root layout:
  `src/app/(app)/` (the feed + sessions screens, our fonts/theme) and
  `src/app/(payload)/` (the admin panel + the `/api/*` REST routes).
- `src/payload.config.ts` is the CMS config (collections, SQLite adapter,
  secret). `DATABASE_URI` in `.env.local` points at a local SQLite file
  (`cookie-training.db`); uploaded files land in `/media`. Both are
  gitignored — back them up like you would any other database + uploads
  directory if this goes to production.
- `src/seed.ts` (`npm run seed`) is the one-time content seed described
  above; `src/seed-assets.ts` is a tiny hand-rolled PNG generator used
  only to give the seeded sessions real (if plain) placeholder images
  without needing real video files. Upload real clips through the
  `/sessions` form or `/admin` to replace them.
