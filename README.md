# Meet in Motion

A discovery platform for **active social events in Singapore**, built on the idea of
*soft socializing* — low-pressure, low-cost, activity-anchored ways of spending time
with people. The activity carries the interaction so conversation doesn't have to.

Runs, padel, pickleball, bouldering, run clubs, HYROX, social leagues — plus the
things that surround them: gym promotions before a race, and reputable guides on how
to prepare for one.

## What the platform does

1. **Aggregates** active social events in Singapore from feeds, scrapers and human
   submissions.
2. **Enriches** each one with *soft-socializing attributes* — is it solo-friendly, can
   you drop in, how much talking is expected — inferred by AI, then confirmed by a human.
3. **Publishes daily** — every day, curated posts go out to the website and to the
   Telegram and WhatsApp channels. Not a weekly digest.
4. **Surrounds events with context** — related promotions (a gym offer before HYROX)
   and vetted resources (how to run a marathon in heat and humidity).
5. **Collects interest** — people sign in with a magic link, record what they're into,
   and register interest in events. Activity pages show counts, including how many
   others are first-timers.
6. **Connects people to coaches** — professional and peer coaches surface beside the
   events they suit. Introductions, not bookings.

## Repository layout

| Path | Contents |
|---|---|
| `docs/data-model.md` | Collections, fields, relationships, status workflow, roles |
| `docs/enrichment.md` | The soft-socializing attribute set and the AI-infer / human-confirm contract |
| `docs/daily-publishing.md` | How the daily post cadence works and stays idempotent |
| `docs/accounts-and-supply.md` | Event types, magic-link accounts, social proof, and the three supply modes |
| `docs/assisted-publishing.md` | Posting to channels with no API, without a chore or a banned account |
| `docs/coaches.md` | The coach directory, the trust model, and why enquiries are not bookings |
| `docs/directus-setup.md` | Running the stack, and what the bootstrap configures |
| `docs/worker.md` | Ingest guarantees, the Eventbrite adapter, and how to add a source |
| `docs/channel-copy.md` | Per-channel copy generation, validation and the repair round |
| `docs/deployment.md` | Running it on DigitalOcean App Platform |
| `docs/site.md` | The public site: routes, UI rules, and how to run it locally |
| `docs/telegram-setup.md` | Creating the bot and channel, and the three values to save |
| `schema/001_init.sql` | Postgres DDL for the core model, Directus-compatible |
| `schema/002_accounts_and_supply.sql` | Accounts, interests, social proof, submissions, organiser claims |
| `schema/003_assisted_publish_and_coaches.sql` | Assisted publishing state, coach directory and enquiries |
| `schema/004_variant_notes.sql` | Why a generated variant was rejected |
| `schema/005_seed_singapore_clubs.sql` | The starting club ecosystem, and which channels are live |
| `schema/tests/` | Executable checks for the invariants the migrations enforce |
| `docker-compose.yml` | Postgres, Redis and Directus for local development |
| `.do/app.yaml` | DigitalOcean App Platform spec — services, scheduled jobs, database |
| `directus/bootstrap/` | Idempotent script registering collections, field interfaces and access policies |
| `worker/` | Ingest, enrichment and publishing — kept outside Directus |
| `site/` | The public Next.js site |

## Stack

Directus over Postgres is the content backbone: content model, editorial workflow,
roles and permissions, asset library, REST/GraphQL API. Next.js serves the public site.
A separate Node worker handles the heavy lifting — ingestion, dedupe, AI enrichment,
image processing and multi-channel publishing — so Directus does not become a fragile
all-in-one automation box.

## Getting started

```sh
cp .env.example .env && docker compose up -d
psql "$DATABASE_URL" -f schema/001_init.sql   # then 002, 003
npm --prefix directus/bootstrap install && npm --prefix directus/bootstrap start
```

See `docs/directus-setup.md`.

## Status

The pipeline is complete end to end: ingest → enrich → schedule → channel copy →
publish, plus the public site and the DigitalOcean deployment spec.

Nothing is deployed and no real source has been ingested yet. See
`docs/deployment.md` and `docs/telegram-setup.md` for what that takes.
