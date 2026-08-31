# The worker

Ingest, enrichment and publishing. Deliberately outside Directus, so a broken scraper
cannot take the CMS down with it.

```sh
cd worker && npm install
node src/index.mjs sources                        # what is configured, and how it last went
node src/index.mjs ingest --dry-run               # fetch and map, write nothing
node src/index.mjs ingest --source eventbrite-ecrc
npm test                                          # add TEST_DATABASE_URL for the integration tests
```

## Eventbrite: an enricher, not a discovery source

**Eventbrite shut down its public event search API in December 2019.** There is no
endpoint that searches events across the platform. What remains is retrieval by event id,
by venue, and by organisation; broader access needs their distribution partner programme,
which is an application rather than an API key.

So the adapter does not find events. It turns events we already know about into complete,
structured listings. Two modes:

| Mode | Config | Use |
|---|---|---|
| `organization` | `organization_id` | Follow a specific organiser who has authorised us — a gym, a race organiser |
| `event_url` | `urls: [...]` | Resolve submitted Eventbrite links to full event data |

That makes **community submissions the discovery mechanism** and Eventbrite the thing that
turns a pasted URL into a complete listing. It is a better division of labour than
scraping would have been, and it is entirely within Eventbrite's terms.

Configure a source:

```sql
INSERT INTO sources (name, slug, type, config, terms_note) VALUES (
  'Eventbrite — East Coast Run Club',
  'eventbrite-ecrc',
  'api',
  '{"adapter":"eventbrite","mode":"organization","organization_id":"55501"}'::jsonb,
  'Organiser authorised us via OAuth on 2026-08-30.'
);
```

`terms_note` is not decoration — it records the basis on which we ingest, so the decision
stays reviewable.

## What ingest guarantees

**Re-running is safe.** An unchanged payload updates `last_verified_at` and nothing else.
A cron that fires twice cannot duplicate an activity or a session. Identity is
`dedupe_key` — organiser, normalised title, first session date.

**Editorial work is never overwritten.** Ingest owns facts: times, prices, capacity,
booking URLs. It refreshes prose *only while the activity is still a draft* — once a human
has reviewed it, their summary stands. It never touches `status`, the soft attributes, or
anything a human confirmed.

**Ingest never guesses the soft attributes.** The fixture event says "all paces welcome"
and mentions kopi afterwards, and the adapter still records nothing about `solo_friendly`
or `social_after`. Those are judgements. They belong to the enrichment pass, with evidence
attached and a person confirming. There is a test asserting this, because it is exactly
the shortcut a future change would take.

**A cancelled session is not resurrected.** Sessions are replaced from the source on each
run, except cancelled ones — a cancellation is information a reader needs, and quietly
reinstating an event that is not happening is worse than a stale listing.

**One bad item does not abort the run.** Failures are recorded on the `raw_items` row with
the parse error, and the run continues. The source ends `partial` rather than `ok`.

**Everything fetched is kept.** `raw_items` holds the untouched payload and the verdict —
`parsed`, `rejected` with a reason, or `error` — so any dedupe or filter decision can be
explained months later.

## What ingest filters

Online-only events (not a place you turn up to), non-live events, and Eventbrite
categories outside Sports & Fitness and Health & Wellness. An event with **no** category
is let through for a human to judge rather than dropped.

## Adding a source

An adapter is a module exporting `key`, `validateConfig`, `fetchItems` (an async
generator yielding `{ externalId, url, payload }`), `toActivity`, `dedupeKey`, and
optionally `isRelevant`. Register it in the `ADAPTERS` map in `src/index.mjs`. Everything
below the adapter — dedupe, raw item audit, organiser and venue upserts, session sync,
poll state — is shared and needs no changes.

## Verification

`npm test` runs 20 tests. Twelve cover the adapter against a recorded fixture with no
network. Eight are end-to-end against a real PostgreSQL 16 database carrying `schema/*.sql`
with Eventbrite stubbed, and they run only when `TEST_DATABASE_URL` is set.

Two bugs were found by those tests and fixed in the code rather than the test: the adapter
could emit `price_max < price_min` (which the database rejects, losing the whole event),
and ingest was overwriting an editor's rewritten summary on re-fetch.

## Next

The enrichment pass, writing `enrichment_proposals` with evidence quoted from the listing.
Then the daily post job. Both read what ingest produces.
