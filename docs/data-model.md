# Data model

Directus collections, fields, relationships and the status workflow. The DDL in
`schema/001_init.sql` implements exactly what is described here.

## Design principles

1. **The activity is the canonical record.** Everything — website page, Telegram post,
   Instagram caption — is generated from it, never written independently per channel.
2. **Recurrence is intrinsic, not an edge case.** A weekly run club and a one-off race
   are the same shape: an `activity` with one or many `sessions`.
3. **Soft attributes are first-class columns**, not tags. They are the differentiator,
   so they need to be filterable and reviewable.
4. **AI proposes, a human disposes.** No inferred value reaches the public site until a
   person confirms it. See `enrichment.md`.
5. **Publication is idempotent from day one.** One row per post + channel, unique. A
   retry can never double-post.
6. **Ingestion is auditable.** The raw payload is kept, so a dedupe or parse decision can
   always be explained.

## Collection map

```
organisers ──< activities >── venues
                  │
                  ├──< sessions            (occurrences: one-off or recurring)
                  ├──< enrichment_proposals (AI suggestions awaiting confirmation)
                  ├──< interest_registrations >── people
                  ├──< activity_promotions >── promotions
                  ├──< activity_resources  >── resources
                  ├──< activity_tags       >── tags
                  └──< sponsorships

sources ──< raw_items ──> activities        (ingest + dedupe audit trail)

activities ─┐
promotions  ├──> posts ──< post_variants >── channels
resources   ─┘     │            │
                   │            └──< publications   (unique per post+channel)
                   └──< campaign_posts >── campaigns
```

---

## Core content

### `organisers`
Who runs the thing. A run club, a race organiser, a gym, a padel venue operator, a brand.
Deliberately separate from `venues` — a run club is not the park it meets in.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name`, `slug` | string | slug unique |
| `type` | enum | `club`, `race_organiser`, `gym`, `studio`, `venue_operator`, `brand`, `community_group`, `individual` |
| `website`, `instagram`, `telegram`, `whatsapp` | string | where the community actually lives |
| `logo` | uuid | → `directus_files` |
| `description` | text | |
| `is_verified` | bool | we have confirmed they are real and active |
| `status` | enum | `draft`, `active`, `archived` |

### `venues`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name`, `slug` | string | |
| `address`, `postal_code` | string | |
| `region` | enum | `central`, `north`, `north_east`, `east`, `west` — Singapore planning regions |
| `nearest_mrt` | string | matters more than coordinates for turnout |
| `latitude`, `longitude` | numeric | |
| `is_outdoor` | bool | drives weather relevance |
| `status` | enum | `draft`, `active`, `archived` |

### `activities`
The canonical record. One row per *thing you can go to*, whether it happens once or weekly.

**Identity**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `title`, `slug` | string | slug unique |
| `summary` | text | canonical one-paragraph description; all channel copy derives from it |
| `description` | text | long form for the website |
| `organiser`, `venue` | uuid | → `organisers`, `venues` |
| `category` | uuid | → `categories` |
| `hero_image` | uuid | → `directus_files` |
| `source`, `source_url` | uuid, string | provenance |
| `dedupe_key`, `content_hash` | string | `dedupe_key` unique; see Dedupe below |

**Shape of the activity**

| Field | Type | Notes |
|---|---|---|
| `format` | enum | `one_off`, `recurring`, `course`, `open_play`, `league`, `race` |
| `intensity` | enum | `gentle`, `moderate`, `vigorous`, `competitive` |
| `skill_level` | enum | `any`, `beginner`, `improver`, `intermediate`, `advanced` |
| `capacity`, `spots_remaining` | int | 4 for a padel court, 400 for a race |
| `cost_band` | enum | `free`, `under_20`, `20_to_50`, `50_to_100`, `over_100` |
| `price_min`, `price_max`, `currency` | numeric, string | exact figures when known |
| `booking_url`, `booking_platform` | string | e.g. Playtomic, Peatix, organiser's own |

**Soft-socializing attributes** — the differentiator. Every one of these is AI-inferred
then human-confirmed; see `enrichment.md`.

| Field | Type | Notes |
|---|---|---|
| `solo_friendly` | enum | `yes`, `probably`, `unlikely`, `unknown` — the question users are silently asking |
| `pressure_level` | enum | `drop_in`, `rsvp`, `commit` |
| `conversation_load` | enum | `parallel`, `light`, `conversational` — pottery vs. book club |
| `group_size` | enum | `intimate` (≤8), `small` (9–20), `medium` (21–60), `large` (60+) |
| `newcomer_norm` | enum | `common`, `occasional`, `rare`, `unknown` — will I be the only new face? |
| `social_after` | bool | is there a coffee/kopi/drinks element |
| `confirmed_fields` | jsonb | array of attribute keys a human has confirmed |
| `enrichment_status` | enum | `not_started`, `proposed`, `partially_confirmed`, `confirmed` |

**Workflow**

| Field | Type | Notes |
|---|---|---|
| `status` | enum | see Workflow below |
| `is_featured` | bool | editorial pick |
| `quality_score` | int | 0–100, ranking input for daily selection |
| `published_at`, `first_seen_at`, `last_verified_at` | timestamptz | |
| `sort`, `user_created`, `date_created`, `user_updated`, `date_updated` | | Directus housekeeping |

### `sessions`
Occurrences of an activity. A one-off race has one row; a Tuesday run club has many.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `activity` | uuid | → `activities`, cascade delete |
| `starts_at`, `ends_at` | timestamptz | |
| `timezone` | string | default `Asia/Singapore` |
| `recurrence_rule` | string | RFC 5545 RRULE for the generating pattern, nullable |
| `venue` | uuid | override when a session moves |
| `capacity`, `spots_remaining` | int | override per session |
| `status` | enum | `scheduled`, `full`, `cancelled`, `completed` |

Sessions are **materialised**, not computed at read time: a recurring activity has real
rows generated ahead of a horizon (default 90 days). This keeps "what's on this Saturday"
a plain indexed query, and lets a single week be cancelled or moved without special-casing.

### `categories` and `tags`
`categories` is a shallow tree (self-referencing `parent`) for the primary taxonomy —
running, racket sports, strength, water, cycling, mind-body, social-non-sport. `tags` is
flat and free-growing (`hyrox`, `trail`, `beginner-friendly`, `women-only`, `dog-friendly`),
joined via `activity_tags`.

---

## Surrounding content

### `promotions`
An offer connected to the active world — a gym's 2-week trial in the run-up to HYROX, a
running-shoe discount before a marathon. Note the reversal from a deals site: a promotion
is **context around an activity**, not the main object.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `title`, `summary` | string, text | |
| `organiser` | uuid | → `organisers`, who is offering it |
| `offer_type` | enum | `percent_off`, `amount_off`, `free_trial`, `bundle`, `freebie`, `bogo`, `early_bird` |
| `discount_value`, `currency` | numeric, string | |
| `promo_code`, `requires_code` | string, bool | |
| `landing_url` | string | |
| `starts_at`, `ends_at` | timestamptz | |
| `is_paid_placement` | bool | drives the disclosure label — see Sponsorship |
| `status` | enum | `draft`, `pending_review`, `approved`, `published`, `expired`, `rejected`, `archived` |

Linked to activities via **`activity_promotions`**, which carries `relevance_reason`
(free text, e.g. "HYROX prep") and `relevance_score`. A promotion may link to several
activities, or to none.

### `resources`
Reputable third-party context: a YouTube video on HYROX station technique, an article on
running in heat and humidity. Curated and reused, not scraped wholesale.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `url` | string | unique |
| `type` | enum | `video`, `article`, `guide`, `podcast`, `study`, `thread` |
| `title`, `publisher`, `author` | string | |
| `summary` | text | our own summary, so we are not republishing their copy |
| `duration_seconds`, `published_date`, `thumbnail_url` | | |
| `credibility` | enum | `pending`, `reputable`, `questionable`, `rejected` |
| `credibility_note` | text | why a human made that call |
| `topics` | jsonb | e.g. `["heat_acclimatisation","hydration"]`, so one resource serves many activities |
| `status` | enum | `draft`, `pending_review`, `approved`, `published`, `archived` |

Linked via **`activity_resources`** with `relevance_reason` and `relevance_score`.

**Copyright posture:** we store the URL, our own summary, and metadata. We link out. We do
not mirror article bodies or re-host video. `credibility` must be human-set to `reputable`
before a resource can be published — AI may propose, never approve.

---

## Demand side

### `people`
One row per human, deduped on email, created on first interest registration.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `email` | citext | unique |
| `name`, `phone`, `telegram_handle` | string | |
| `marketing_consent`, `consent_at`, `consent_text_version` | bool, timestamptz, string | PDPA — see below |
| `unsubscribed_at` | timestamptz | |
| `status` | enum | `active`, `unsubscribed`, `bounced`, `deleted` |

### `interest_registrations`
The v1 data-collection mechanism: *"I'm interested in this."* Not a booking — we are not
taking money or guaranteeing a slot, and the copy should say so.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `activity`, `session` | uuid | session nullable — interest can be in the activity generally |
| `person` | uuid | → `people` |
| `interest_level` | enum | `curious`, `likely`, `committed` |
| `party_size` | int | default 1 — "can I bring a friend" is a real signal |
| `is_first_timer` | bool | directly feeds the `newcomer_norm` attribute |
| `notes` | text | free text from the person |
| `channel` | string | where they registered: website, telegram, whatsapp |
| `status` | enum | `registered`, `contacted`, `attended`, `no_show`, `withdrawn` |

Unique on `(activity, person)` — one registration per person per activity, updated rather
than duplicated.

**PDPA (Singapore).** Interest registration collects personal data, so: consent is
explicit and separate from the registration action, the consent text version is stored
against the person, marketing consent is distinct from event-specific contact, and
withdrawal is honoured via `unsubscribed_at`. Do not add a pre-ticked consent box.

**Community seam (phase 2).** `activities.discussion_group_url` holds an external
Telegram/WhatsApp group link, which is the cheapest v1 answer to "their own forum or chat".
When you outgrow it, the native path is `groups` / `threads` / `messages` keyed off
`activity`, with membership derived from `interest_registrations`. Not built yet —
deliberately, since a dead forum is worse than no forum.

---

## Ingestion

### `sources`
One row per feed, scraper, API or manual entry point.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name`, `slug` | string | |
| `type` | enum | `api`, `rss`, `scraper`, `manual`, `submission`, `email` |
| `url`, `config` | string, jsonb | selectors, credentials reference, parse rules |
| `organiser` | uuid | when a source belongs to one organiser |
| `poll_interval_minutes` | int | |
| `is_active`, `last_polled_at`, `last_status`, `last_error` | | |
| `terms_note` | text | **what we are permitted to do with this source** |

`terms_note` is not decoration. Several candidate sources restrict scraping; the field
records the basis on which we ingest so the decision is reviewable later.

### `raw_items`
The untouched payload, kept so dedupe and parse decisions are auditable.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `source` | uuid | → `sources` |
| `external_id` | string | source's own id, unique per source |
| `url`, `raw_payload` | string, jsonb | |
| `content_hash` | string | detects unchanged re-fetches |
| `fetched_at` | timestamptz | |
| `status` | enum | `new`, `parsed`, `duplicate`, `rejected`, `error` |
| `activity` | uuid | what it resolved into, nullable |
| `dedupe_note` | text | why it was judged a duplicate |

**Dedupe.** `activities.dedupe_key` is a normalised composite of organiser + title + first
session date + venue. On ingest: exact `content_hash` match → ignore; `dedupe_key` match →
merge into the existing activity and update `last_verified_at`; near-match on
title similarity + overlapping date → flag for human review rather than auto-merging.
Auto-merge on fuzzy matching alone silently destroys real events.

---

## Publishing

### `channels`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `key` | string | unique: `website`, `telegram`, `whatsapp`, `instagram`, `facebook`, `newsletter`, `push` |
| `name`, `is_active` | | |
| `config` | jsonb | `max_length`, `supports_links`, `image_aspect`, `hashtag_limit` |

### `posts`
The editorial unit — one thing published on one day. This is what makes "daily posts" a
first-class concept rather than an emergent property.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `type` | enum | `event_spotlight`, `resource`, `promotion`, `roundup`, `announcement` |
| `activity`, `promotion`, `resource` | uuid | exactly one set, enforced by CHECK, per `type` |
| `headline`, `body`, `hero_image` | | canonical copy; variants derive from this |
| `scheduled_for` | date | the day it goes out |
| `slot` | enum | `morning`, `midday`, `evening` |
| `status` | enum | `draft`, `pending_review`, `approved`, `scheduled`, `published`, `failed`, `archived` |
| `campaign` | uuid | → `campaigns`, nullable |

Unique on `(scheduled_for, slot, type)` — prevents two spotlights colliding in one slot and
makes gaps in the calendar visible.

### `post_variants`
Channel-specific rendering of a post. Separate from `publications` so copy can be
regenerated without touching publication history.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `post`, `channel` | uuid | unique together |
| `headline`, `body`, `hashtags`, `image` | | |
| `status` | enum | `draft`, `approved`, `rejected` |
| `generated_by` | enum | `ai`, `human` |
| `model`, `prompt_version` | string | reproducibility |

### `publications`
The idempotency ledger. **Unique on `(post, channel)`.** A retry updates this row; it
never inserts a second one.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `post`, `channel`, `variant` | uuid | |
| `idempotency_key` | string | unique; `{post_id}:{channel_key}` |
| `status` | enum | `pending`, `queued`, `sending`, `published`, `failed`, `skipped`, `revoked` |
| `external_post_id`, `external_url` | string | |
| `published_at`, `attempts`, `last_error`, `payload_hash` | | |

### `campaigns`
Groups posts into a themed arc — "HYROX prep week" pulling together the race, gym
promotions and preparation resources across several days. Junction: `campaign_posts`.

### `sponsorships`
Paid placement, kept separate from editorial so disclosure is structural rather than a
convention someone remembers.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `advertiser` | uuid | → `organisers` |
| `activity`, `promotion`, `post` | uuid | what is being boosted |
| `tier` | enum | `featured`, `boosted`, `sponsored` |
| `starts_at`, `ends_at`, `amount`, `currency` | | |
| `disclosure_label` | string | e.g. "Sponsored" — rendered on every surface, non-optional |
| `status` | enum | `draft`, `active`, `ended`, `cancelled` |

Any activity or post with an active sponsorship **must** render its `disclosure_label` on
every channel. Singapore advertising guidelines require clear identification of paid
content, and the model should make omitting it hard rather than merely discouraged.

---

## Workflow

### Activity lifecycle

```
                    ┌──────────────► rejected
                    │
draft ──► pending_review ──► approved ──► published ──► expired ──► archived
  ▲               │  ▲                        │
  │               ▼  │                        │
  └────────── needs_info ◄───────────────────┘
```

| From | To | Who |
|---|---|---|
| — | `draft` | ingest worker, editor, public submission |
| `draft` | `pending_review` | ingest worker (once enrichment proposed), editor |
| `pending_review` | `approved` | approver — **requires all soft attributes confirmed** |
| `pending_review` | `needs_info` / `rejected` | approver, editor |
| `approved` | `published` | publish worker (fires the outbound webhook) |
| `published` | `needs_info` | editor, or auto when a link check fails |
| `published` | `expired` | scheduled job when the last session ends |
| any | `archived` | admin |

The transition that matters is `pending_review → approved`: it is blocked unless
`enrichment_status = 'confirmed'`. That is what keeps AI inference off the public site
without a person's sign-off.

### Post lifecycle

`draft → pending_review → approved → scheduled → published`, with `failed` on publish
error (retryable via the same `publications` row) and `archived` as the terminal exit.

### Roles

| Role | Can |
|---|---|
| `ingest_bot` | create `raw_items`, create `activities` as `draft`, create `enrichment_proposals`. **Cannot** approve, publish, or set `credibility` |
| `editor` | edit content, move to `pending_review`, confirm enrichment proposals, create posts |
| `approver` | `approved` / `rejected` / `needs_info`, set resource `credibility` |
| `publish_bot` | read `approved` posts, write `publications`, move posts to `published` |
| `admin` | everything, including `archived` and sponsorship records |

The separation that matters: **no bot role can approve, and no bot can mark a resource
reputable.** Both are the places where an automated mistake becomes a public one.
