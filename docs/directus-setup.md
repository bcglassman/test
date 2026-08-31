# Directus setup

Directus is the content model, the editorial surface and the API. It is **not** the owner
of the schema — `schema/*.sql` is. `SCHEMA_CHANGES: none` in `docker-compose.yml` enforces
that: Directus can read and edit rows, but it cannot silently reshape a table the
migrations own.

## Running it

```sh
cp .env.example .env          # fill in secrets; openssl rand -base64 32 for DIRECTUS_SECRET
docker compose up -d

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f schema/001_init.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f schema/002_accounts_and_supply.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f schema/003_assisted_publish_and_coaches.sql

cd directus/bootstrap
npm install
npm run plan     # dry run: prints what would change, touches nothing
npm start        # apply
```

Order matters: the tables must exist before the bootstrap registers them.

## What the bootstrap does

`directus/bootstrap/` registers the collections, configures the field interfaces and
creates the access policies. It is **idempotent** — run it after every migration and
after any edit to `model.mjs`.

It never creates or alters a table.

| Step | What |
|---|---|
| Groups | Five sidebar folders in the order an editor works: Content, Pipeline, Publishing, People, Taxonomy |
| Collections | Registers each table with an icon, a note, a display template, and archive behaviour wired to `status` |
| Fields | Derives dropdowns from CHECK constraints, then applies the overrides in `model.mjs` |
| Policies | Editor, Approver, Ingest bot, Publish bot — with their permissions |

## Dropdowns come from the database

The schema already says, in one place, that `activities.solo_friendly` is one of
yes / probably / unlikely / unknown. Re-typing that into a Directus field config would
create a second source of truth that drifts the first time someone adds a value in SQL.

So the bootstrap reads `pg_constraint` and turns every single-column value-list CHECK
into a select dropdown — **52 columns** at the current schema. Range checks and
cross-column rules (the enrichment gate, the consent rules) are correctly ignored: they
are rules, not value lists.

Add a value to a CHECK constraint in a migration, re-run the bootstrap, and the dropdown
follows. It cannot offer a value the database would reject.

Unit tests: `npm test` in `directus/bootstrap`.

## Access policies

Directus 11 replaced role-attached permissions with **policies** that attach to roles and
users. The bootstrap creates four policies; you create a role per person in the Data
Studio and attach the policies they need. That split is the point of the policy model —
one person can be an Editor and an Approver without a bespoke role for the combination.

| Policy | Can | Cannot |
|---|---|---|
| **Editor** | Edit all content, confirm AI proposals, build posts | Move an activity past `pending_review` |
| **Approver** | Everything an Editor can, plus approve/reject, set resource credibility and coach verification | — |
| **Ingest bot** | Write raw items, draft activities, sessions, AI proposals; update source poll state | Approve anything; set credibility or verification; write `status = approved` |
| **Publish bot** | Read approved posts, write variants and the publication ledger | Edit content of any kind |

**The two absences are the design.** No bot can approve, and no bot can mark a resource
reputable or a coach verified — those are the places where an automated mistake becomes a
public one. The database enforces the gates regardless; the policies stop a bot reaching
them at all.

Policies are replaced wholesale on each run, so `model.mjs` is the source of truth. An
edit made in the Data Studio will be overwritten — change the file instead.

## Editing the model

- **A new table** → add a migration, then add an entry to `collections` in `model.mjs`.
- **A new enum value** → change the CHECK constraint in a migration. Nothing else.
- **A field that needs a better interface or a note** → add it to `fields` in `model.mjs`,
  keyed `collection.field`. Anything omitted keeps what Directus infers, which is usually
  right; the entries there are the fields where a wrong default costs a reviewer time.

## Verification status

The SQL migrations and the choices derivation are verified against PostgreSQL 16, and the
parser has unit tests. **The Directus API calls in `index.mjs` have not been executed
against a running Directus instance** — there was no Docker daemon available in the
environment where this was written. Run `npm run plan` first: it prints every intended
change without making one.
