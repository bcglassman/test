# Active SG

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
3. **Publishes daily** — every day, curated posts go out to the website and messaging
   channels. Not a weekly digest.
4. **Surrounds events with context** — related promotions (a gym offer before HYROX)
   and vetted resources (how to run a marathon in heat and humidity).
5. **Collects interest** — people register interest in an event. That is the v1
   data-collection mechanism and the seam for community features later.

## Repository layout

| Path | Contents |
|---|---|
| `docs/data-model.md` | Collections, fields, relationships, status workflow, roles |
| `docs/enrichment.md` | The soft-socializing attribute set and the AI-infer / human-confirm contract |
| `docs/daily-publishing.md` | How the daily post cadence works and stays idempotent |
| `schema/001_init.sql` | Postgres DDL for the whole model, Directus-compatible |

## Stack

Directus over Postgres is the content backbone: content model, editorial workflow,
roles and permissions, asset library, REST/GraphQL API. Next.js serves the public site.
A separate Node worker handles the heavy lifting — ingestion, dedupe, AI enrichment,
image processing and multi-channel publishing — so Directus does not become a fragile
all-in-one automation box.

## Status

Design and schema only. No application code yet.
