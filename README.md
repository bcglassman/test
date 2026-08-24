# Cookie Training

A simple exercise journal for tracking training sessions: a public feed and
an editing screen for logging new sessions.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the feed, and
[http://localhost:3000/sessions](http://localhost:3000/sessions) for the
editing screen.

## Screens

- **`/` — Training Feed.** A chronological, filterable feed of sessions.
  Each session shows its exercise, ratings, a trend vs. the previous
  session for that same exercise, and its media (video/photo) items.
- **`/sessions` — Sessions.** List of all sessions plus a form to add or
  edit one: exercise, date/time, flexible ratings, sets/reps/rest,
  notes, and media items (upload, caption, reorder, remove).

## Data model

Defined in `src/lib/types.ts`:

- **Exercise** — the reusable exercise definition (name, category, focus,
  default rating dimensions).
- **TrainingSession** — one instance of performing an exercise: ratings,
  sets/reps/rest, notes, and its media items.
- **MediaItem** — a video or image belonging to a session (label, notes,
  order). Sets, videos, and photos are all just media items — there's no
  separate concept for each.
- **RatingDimension** — ratings are a flexible list of `{ key, label,
  score, max }`, not fixed columns, so different exercises can define
  different dimensions later without a schema change.

Right now everything is stored in the browser's `localStorage`, seeded from
`src/lib/seed-data.ts` on first load. There's no server-side persistence or
real file storage yet — uploaded media only lives as an in-browser object
URL for the current session.

## Connecting a real CMS later

All reads/writes go through `src/lib/data-source.ts` — `getExercises()`,
`getSessions()`, `saveSession()`, `deleteSession()`. Nothing else in the
app touches storage directly. To swap in a headless CMS (Sanity,
Contentful, Payload, etc.):

1. Create matching content types for `Exercise`, `TrainingSession`, and
   `MediaItem` (the shapes in `src/lib/types.ts` map directly to CMS
   schemas/fields).
2. Replace the bodies of the functions in `data-source.ts` with calls to
   the CMS's SDK/API (fetching sessions, and creating/updating a session +
   its media on save). Keep the same function signatures.
3. Add file/asset upload to the CMS's media library in place of
   `URL.createObjectURL()` in `src/lib/media-utils.ts`.

Because every screen already reads through this one module, this is a
localized change — no component changes needed.
